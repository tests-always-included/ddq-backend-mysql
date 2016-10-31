"use strict";

const EMIT_DATA = "data", EMIT_ERR = "error";

module.exports = (configValidation, crypto, EventEmitter, mysql, timers) => {
    var cycleCounter, setRequeued;

    /**
     * Updates heartbeatDate of a specific record and calls the callback that is
     * passed in.
     *
     * @param {Object} ddqBackendInstance
     * @param {string} recordId
     * @param {Function} callback
     */
    function heartbeat(ddqBackendInstance, recordId, callback) {
        ddqBackendInstance.connection.query(`
            UPDATE ??
            SET heartbeatDate = NOW()
            WHERE hash = ?
                AND isProcessing = true
                AND owner = ?`,
            [
                ddqBackendInstance.config.table,
                recordId,
                ddqBackendInstance.owner
            ], callback
        );
    }


    /**
     * Updates a specific record so that it can be requeued.
     *
     * @param {Object} ddqBackendInstance
     * @param {string} recordId
     * @param {Function} callback
     */
    function requeue(ddqBackendInstance, recordId, callback) {
        ddqBackendInstance.connection.query(`
            UPDATE ??
            SET owner = null,
                isProcessing = false,
                requeued = false
            WHERE hash = ?`,
            [
                ddqBackendInstance.config.table,
                recordId
            ], callback
        );
    }


    /**
     * Deletes a specific record from the database. If unsuccessful, this will
     * call the command to requeue the record.
     *
     * @param {Object} ddqBackendInstance
     * @param {string} recordId
     * @param {Function} callback
     */
    function remove(ddqBackendInstance, recordId, callback) {
        ddqBackendInstance.connection.query(`
            DELETE
            FROM ??
            WHERE hash = ?
                AND requeued = false
                AND owner = ?`,
            [
                ddqBackendInstance.config.table,
                recordId,
                ddqBackendInstance.owner
            ], (err) => {
                if (err) {
                    requeue(ddqBackendInstance, recordId, callback);
                } else {
                    callback();
                }
            }
        );
    }


    /**
     * Polls for a random record with the minimum delay defined by the
     * config.pollingDelayMs.
     *
     * @param {Object} ddqBackendInstance
     */
    function poll(ddqBackendInstance) {
        /**
         * Queries the database to get a random record. Emits that random record
         * along with methods to handle it.
         */
        function checkNow() {
            var wrappedMessage;

            ddqBackendInstance.poller = null;

            ddqBackendInstance.connection.query(`
                SELECT *
                FROM ??
                WHERE isProcessing = false
                    AND RAND() < 4 / (
                        SELECT COUNT(*)
                        FROM ??
                        WHERE isProcessing = false
                        AND topics IN (?)
                    )
                    AND topics IN (?)
                ORDER BY RAND()
                LIMIT 1`,
                [
                    ddqBackendInstance.config.table,
                    ddqBackendInstance.topics
                ], (err, record) => {
                    if (err) {
                        ddqBackendInstance.emit(EMIT_ERR, err);
                    } else {
                        wrappedMessage = {
                            heartbeat: heartbeat.bind(null, ddqBackendInstance, record[0].hash),
                            message: record[0].message,
                            requeue: requeue.bind(null, ddqBackendInstance, record[0].hash),
                            remove: remove.bind(null, ddqBackendInstance, record[0].hash),
                            topic: record[0].topic
                        };

                        ddqBackendInstance.emit(EMIT_DATA, wrappedMessage);
                    }

                    if (ddqBackendInstance.currentlyPolling === true) {
                        ddqBackendInstance.poller = timers.setTimeout(checkNow, ddqBackendInstance.config.pollingDelayMs);
                    }
                }
            );
        }

        ddqBackendInstance.poller = timers.setTimeout(checkNow, ddqBackendInstance.config.pollingDelayMs);
    }


    /**
     * Ensures that heartbeatCleanup is ready to run according to the
     * heartbeatCleanupDelay. This will continue until pausePolling is called.
     *
     * @param {Object} ddqBackendInstance
     */
    function restore(ddqBackendInstance) {
        /**
         * Queries for jobs that have stopped, and primes them to be cleaned up.
         */
        function heartbeatCleanup() {
            ddqBackendInstance.restorer = null;

            ddqBackendInstance.connection.query(`
                UPDATE ??
                SET isProcessing = false,
                    owner = null,
                    requeued = false
                WHERE DATEDIFF(NOW(), SEC_TO_TIME(?)) > heartbeatDate
                    AND isProcessing = true`,
                [
                    ddqBackendInstance.config.table,
                    ddqBackendInstance.config.heartbeatLifetimeSeconds
                ], (err) => {
                    if (err) {
                        ddqBackendInstance.emit(EMIT_ERR, err);
                    }

                    if (ddqBackendInstance.currentlyRestoring === true) {
                        ddqBackendInstance.restorer = timers.setTimeout(heartbeatCleanup, ddqBackendInstance.config.heartbeatCleanupDelayMs);
                    }
                }
            );
        }

        ddqBackendInstance.restorer = timers.setTimeout(heartbeatCleanup, ddqBackendInstance.config.heartbeatCleanupDelayMs);
    }


    /**
     * Inserts a record to the database. If it's unable to do so because the
     * record already exists, it will check directly that the entry exists
     * and if it does, attempt to update the record.
     *
     * Inserting a record will repeat as many times as are defined in the
     * config's createMessageCycleLimit.
     *
     * @param {Object} ddqBackendInstance
     * @param {Object} params
     * @param {Function} callback
     */
    function trySendMessage(ddqBackendInstance, params, callback) {
        if (cycleCounter < ddqBackendInstance.config.createMessageCycleLimit) {
            cycleCounter += 1;
            ddqBackendInstance.connection.query(`
                INSERT INTO ?? (hash, message, topic)
                VALUES (?, ?, ?)`,
                [
                    ddqBackendInstance.config.table,
                    params.hash,
                    params.message,
                    params.topic
                ], (err) => {
                    if (err && err.code === "ER_DUP_ENTRY") {
                        setRequeued(ddqBackendInstance, params, callback);
                    } else if (err) {
                        ddqBackendInstance.emit(EMIT_ERR, err);
                    } else {
                        callback();
                    }
                }
            );
        } else {
            callback(new Error("Could not send message."));
        }
    }


    /**
     * Updates a record. If there isn't an error, but no records are updated, it
     * calls the trySendMessage method. Otherwise, it will call the callback
     * that was provided to sendMessage.
     *
     * @param {Object} ddqBackendInstance
     * @param {Object} params
     * @param {Function} callback
     */
    setRequeued = function (ddqBackendInstance, params, callback) {
        ddqBackendInstance.connection.query(`
            UPDATE ??
            SET requeued = true
            WHERE hash = ?
                AND isProcessing = true`,
            [
                ddqBackendInstance.config.table,
                params.hash
            ], (err, data) => {
                if (err) {
                    ddqBackendInstance.emit(EMIT_ERR, err);
                } else if (data.affectedRows === 0) {
                    trySendMessage(ddqBackendInstance, params, callback);
                } else {
                    callback();
                }
            }
        );
    };


    /**
     * Class for the ddqBackendMySql. Inherits from EventEmitter.
     */
    class DdqBackendMySql extends EventEmitter {
        /**
         * Default DdqBackendMySql properties.
         *
         * @param {Object} backendConfig
         */
        constructor(backendConfig) {
            configValidation.validateConfig(backendConfig);
            super();
            this.config = backendConfig;
            this.connection = null;
            this.currentlyPolling = false;
            this.currentlyRestoring = false;
            this.owner = crypto.randomBytes(64).toString("hex");
            this.poller = null;
            this.restorer = null;
            this.topics = backendConfig.topics;
        }


        /**
         * Opens a connection to a MySQL database.
         *
         * @param {Function} callback
         */
        connect(callback) {
            var connectionOptions, mysqlOptions;

            /*
            These are not all of the options that a mysql connection can take,
            only what is most relevant to this plugin.
            See the MySQL documentation for the rest.
            */
            mysqlOptions = [
                "database",
                "host",
                "password",
                "port",
                "table",
                "user"
            ];
            connectionOptions = {};

            mysqlOptions.forEach((key) => {
                if (this.config[key]) {
                    connectionOptions[key] = this.config[key];
                }
            });

            this.connection = mysql.createConnection(connectionOptions);
            this.connection.connect(callback);
        }


        /**
         * Severs the connection to the database.
         *
         * @param {Function} callback
         */
        disconnect(callback) {
            this.connection.end(callback);
        }


        /**
         * Starts polling and restoring.
         *
         * @param {Function} callback
         */
        startListening() {
            this.currentlyRestoring = true;
            this.currentlyPolling = true;
            restore(this);
            poll(this);
        }


        /**
         * Resets the relevant flags and clears the timers, which stops both
         * polling and restoring.
         *
         * @param {Function} [callback]
         */
        stopListening(callback) {
            if (this.restorer) {
                timers.clearTimeout(this.restorer);
                this.restorer = null;
                this.currentlyRestoring = false;
            }

            if (this.poller) {
                timers.clearTimeout(this.poller);
                this.poller = null;
                this.currentlyPolling = false;
            }

            if (callback) {
                callback();
            }
        }


        /**
         * Sets up the parameters for trySendMessage and setRequeued and
         * calls the former.
         *
         * @param {Object} message
         * @param {Function} callback
         * @param {string} [topic]
         */
        sendMessage(message, callback, topic) {
            var hash, params;

            cycleCounter = 0;
            hash = crypto.createHash("sha256");
            hash.update(message);

            if (!topic || typeof topic === "string" && !topic.length) {
                topic = null;
            }

            if (topic !== null) {
                hash.update(topic);
            }

            hash = hash.digest("hex");

            params = {
                hash,
                message,
                topic
            };

            trySendMessage(this, params, callback);
        }
    }

    return DdqBackendMySql;
};

