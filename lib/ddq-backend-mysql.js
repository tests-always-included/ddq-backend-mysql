"use strict";

const EMIT_DATA = "data", EMIT_ERR = "error";

module.exports = (config, configValidation, crypto, EventEmitter, mysql, timers) => {
    /**
     * Updates heartbeatDate of specific record and calls callback that is passed
     * in.
     *
     * @param {Object} ddqBackendInstance
     * @param {string} recordId
     * @param {Function} callback
     */
    function heartbeat(ddqBackendInstance, recordId, callback) {
        ddqBackendInstance.connection.query(`UPDATE ??
            SET heartbeatDate = NOW()
            WHERE hash = ?
            AND isProcessing = true
            AND owner = ?;`,
            [ddqBackendInstance.config.table, recordId, ddqBackendInstance.owner],
            callback
        );
    }


    /**
     * Polls for a random record with a delay defined by the config.pollDelayMs.
     *
     * @param {Object} ddqBackendInstance
     * @param {Function} callback
     */
    function poll(ddqBackendInstance, callback) {
        /**
         * Finds a random record in the database and calls the callback
         * provided to it. Continues to do this until pausePolling is
         * called.
         */
        function findData() {
            ddqBackendInstance.connection.query(`SELECT hash
                FROM ??
                WHERE isProcessing = false
                AND topic IN (?)
                OR topic IS NULL
                ORDER BY RAND()
                LIMIT 1;`,
                [ddqBackendInstance.config.table, ddqBackendInstance.config.topics],
                callback
            );

            ddqBackendInstance.poller = timers.setTimeout(findData, ddqBackendInstance.config.pollDelayMs);
        }

        ddqBackendInstance.poller = timers.setTimeout(findData, ddqBackendInstance.config.pollDelayMs);
    }


    /**
     * Calls method to delete record.
     *
     * @param {Object} ddqBackendInstance
     * @param {string} recordId
     */
    function remove(ddqBackendInstance, recordId) {
        ddqBackendInstance.deleteData(recordId);
    }


    /**
     * Updates a specific record so that it can be requeued.
     *
     * @param {Object} ddqBackendInstance
     * @param {string} recordId
     * @param {Function} callback
     */
    function requeue(ddqBackendInstance, recordId, callback) {
        ddqBackendInstance.connection.query(`UPDATE ??
            SET owner = null, isProcessing = false, requeued = true
            WHERE hash = ?;`,
            [ddqBackendInstance.config.table, recordId],
            callback
        );
    }


    /**
     * Ensures that heartbeatCleanup is ready to run according to the
     * heartbeatCleanupDelay.
     *
     * @param {Object} ddqBackendInstance
     */
    function restore(ddqBackendInstance) {
        /**
         * Queries for jobs that have stopped, and primes them to be cleaned up.
         */
        function heartbeatCleanup() {
            ddqBackendInstance.connection.query(`UPDATE ??
                SET isProcessing = false, owner = null, requeue = false
                WHERE DATEDIFF(NOW() - ? " SECONDS") > heartbeatDate
                AND isProcessing = true;`,
                [ddqBackendInstance.config.table, ddqBackendInstance.config.heartbeatLifetimeSeconds],
                () => {
                    ddqBackendInstance.setHeartbeat();
                }
            );

            ddqBackendInstance.restorer = timers.setTimeout(heartbeatCleanup,
            ddqBackendInstance.heartbeatCleanupDelay);
        }

        ddqBackendInstance.restorer = timers.setTimeout(heartbeatCleanup,
            ddqBackendInstance.heartbeatCleanupDelay);
    }


    /**
     * Class for the ddqBackendMySql. Inherits from EventEmitter.
     */
    class DdqBackendMySql extends EventEmitter {
        /**
         * Default DdqBackendMySql properties.
         *
         * @param {Object} backendConfig
         */
        constructor() {
            configValidation.validateConfig(config);
            super();
            this.config = config;
            this.connection = null;
            this.currentlyPolling = false;
            this.owner = crypto.randomBytes(64);
            this.poller = null;
            this.restorer = null;
            this.topics = config.topics || null;
        }


        /**
         * Disconnects from the database.
         *
         * @param {Function} callback
         */
        disconnect(callback) {
            this.connection.end(callback);
        }


        /**
         * Opens a connection to a MySQL database.
         *
         * @param {Function} callback
         */
        connect(callback) {
            var connectionOptions, mysqlOptions;

            /*
            These are not all of the options that a mysql connection can
            take, only what seemed most relevant to this plugin.
            See the mysql documentation for the rest.
            */
            mysqlOptions = [
                "database",
                "host",
                "password",
                "port",
                "user"
            ];
            connectionOptions = {};

            mysqlOptions.forEach((key) => {
                if (this.config[key]) {
                    connectionOptions[key] = this.config[key];
                }
            });

            this.connection = mysql.createConnection(connectionOptions);
            this.connection.connect((err) => {
                if (err) {
                    throw new Error("There was an error while attempting to connect to the database.");
                }

                callback(false);
            });
        }


        /**
         * Deletes a specific record from the database. If unsuccessful, this
         * will call the command to requeue the record.
         *
         * @param {string} recordId
         */
        deleteData(recordId) {
            this.connection.query(`DELETE FROM ??
                WHERE hash = ?
                AND requeued = false;`,
                [this.config.table, recordId],
                (err, data) => {
                    if (err) {
                        console.log("Error deleting record with id:", recordId);
                        console.log("Attempting requeue");
                        requeue(this, recordId, (requeueErr) => {
                            this.emit(EMIT_ERR, requeueErr);
                        });
                    } else {
                        this.emit(EMIT_DATA, data);
                    }
                }
            );
        }


        /**
         * Gets a specific record from the database.
         *
         * @param {string} recordId
         * @param {Function} callback
         */
        getRecord(recordId, callback) {
            this.connection.query(`SELECT *
                FROM ??
                WHERE hash = ?;`,
                [this.config.table, recordId],
                callback
            );
        }


        /**
         * Queries the database to get a random record. Returns that random
         * record along with a methods to handle the record.
         */
        checkNow() {
            var wrappedMessage;

            this.connection.query(`SELECT *
                FROM ??
                WHERE topic IN (?)
                OR topic IS NULL
                ORDER BY RAND()
                LIMIT 1;`,
                [this.config.table, this.config.topics],
                (err, record) => {
                    if (err) {
                        this.emit(EMIT_ERR, err);
                    }

                    wrappedMessage = {
                        heartbeat: heartbeat.bind(null, this, record[0].hash),
                        message: record[0].messageBase64,
                        requeue: requeue.bind(null, this, record[0].hash),
                        remove: remove.bind(null, this, record[0].hash),
                        topic: record[0].topic
                    };

                    this.emit(EMIT_DATA, wrappedMessage);
                }
            );
        }


        /**
         * Inserts a record to the database. If it's unable to do so because the
         * record already exists, it will check directly that the entry exists
         * and if it does, attempt to update the record.
         *
         * Inserting a record will repeat as many times as are defined in the
         * config's createMessageCycleLimitMs.
         *
         * @param {Object} message
         * @param {string} topic
         * @param {Function} callback
         */
        sendMessage(message, topic, callback) {
            var cycleCounter, ddqBackendInstance, hash, trySendMessage, writeRecord;

            cycleCounter = 0;
            // eslint-disable-next-line consistent-this
            ddqBackendInstance = this;
            hash = crypto.createHash("sha256").update(message).digest("hex");


            /**
             * Checks if a record exists. If it does, the record will be
             * updated. If it doesn't, the record will be written. Emits on
             * error.
             *
             * The UPDATE command in MySQL will not error if a record doesn't
             * exist. Instead, it updates no records. This method, then, is
             * necessary as an explicit check for what to call next if
             * trySendMessage initially fails.
             */
            function checkRecord() {
                ddqBackendInstance.connection.query(`SELECT COUNT(*)
                    FROM ??
                    WHERE hash = ?
                    AND isProcessing = true;`,
                    [ddqBackendInstance.config.table, hash],
                    (err, data) => {
                        if (err) {
                            ddqBackendInstance.emit(EMIT_ERR, err);
                        } else if (data[0]["COUNT(*)"]) {
                            console.log("No records with these parameters exist");
                            console.log("Attempting to create record now");
                            trySendMessage();
                        } else {
                            writeRecord();
                        }
                    }
                );
            }


            trySendMessage = function () {
                if (cycleCounter < ddqBackendInstance.config.createMessageCycleLimitMs) {
                    cycleCounter += 1;
                    ddqBackendInstance.connection.query(`INSERT INTO ?? (hash, messageBase64, topic)
                        VALUES (?, ?, ?);`,
                        [ddqBackendInstance.config.table, hash, message, topic],
                        (err) => {
                            if (err && err.code === "ER_DUP_ENTRY") {
                                console.log("Message already exists");
                                console.log("Attempting to update existing record now.");
                                checkRecord();
                            } else if (err) {
                                ddqBackendInstance.emit(EMIT_ERR, err);
                            } else {
                                callback();
                            }
                        }
                    );
                } else {
                    callback(new Error("Could not send message"));
                }
            };


            writeRecord = function () {
                ddqBackendInstance.connection.query(`UPDATE ??
                    SET requeued = true
                    WHERE hash = ?
                    AND isProcessing = true;`,
                    [ddqBackendInstance.config.table, hash],
                    (err) => {
                        if (err) {
                            ddqBackendInstance.emit(EMIT_ERR, err);
                        } else {
                            console.log("Update Successful");
                            callback();
                        }
                    }
                );
            };

            trySendMessage();
        }


        /**
         * Starts polling.
         */
        listen() {
            this.currentlyPolling = true;
            poll(this);
            restore(this);
        }


        /**
         * Clears the timers to stop polling.
         */
        pausePolling() {
            timers.clearTimeout(this.poller);
            this.poller = null;
            this.restorer = null;
            this.currentlyPolling = false;
        }


        /**
         * Starts polling.
         */
        resumePolling() {
            this.currentlyPolling = true;
            poll(this);
            restore(this);
        }
    }

    return DdqBackendMySql;
};
