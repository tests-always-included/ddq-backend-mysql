"use strict";

const EMIT_DATA = "data", EMIT_ERR = "error";

module.exports = function (config, crypto, EventEmitter, mysql, timers) {
    /**
     * Updates heartbeatDate of specific record and calls callback that is passed
     * in.
     *
     * @param {Object} ddqBackendInstance
     * @param {string} recordId
     * @param {Function} callback
     */
    function heartbeat(ddqBackendInstance, recordId, callback) {
        ddqBackendInstance.connection.query(`UPDATE ?
            SET heartbeatDate = NOW()
            WHERE hash = ?,
            isProcessing = true,
            owner = ?;`,
            [ddqBackendInstance.config.table, recordId, ddqBackendInstance.owner],
            callback()
        );
    }


    /**
     * Boilerplate callback handler that emits either data or err objects
     *
     * @param {Object} ddqBackendInstance
     * @param {Object} err
     * @param {Object} data
     */
    function callbackHandler(ddqBackendInstance, err, data) {
        if (err) {
            ddqBackendInstance.emit(EMIT_ERR, err);
        } else {
            ddqBackendInstance.emit(EMIT_DATA, data);
        }
    }


    /**
     * Updates records in cases where messages have not been updated, so that
     * they can be set up to be reprocessed.
     *
     * @param {Object} ddqBackendInstance
     */
    function heartbeatCleanup(ddqBackendInstance) {
        ddqBackendInstance.connection.query(`UPDATE ?
            SET isProcessing = false, owner = null, requeue = false
            WHERE DATEDIFF(NOW() - ? " SECONDS") > heartbeatDate, isProcessing = true;`,
            [ddqBackendInstance.config.table, ddqBackendInstance.config.heartbeatLifetimeSeconds],
            callbackHandler()
        );
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
     */
    function requeue(ddqBackendInstance, recordId) {
        ddqBackendInstance.connection.query(`UPDATE ?
            SET owner = null, isProcessing = false, requeued = true
            WHERE hash = ?;`,
            [ddqBackendInstance.config.table, recordId],
            callbackHandler()
        );
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
        constructor(backendConfig) {
            super();
            this.config = backendConfig;
            this.connection = null;
            this.owner = crypto.randomdBytes(64);
            this.poller = null;
            this.topics = config.topics;

            setInterval(() => {
                heartbeatCleanup(this);
            }, this.config.heartbeatCleanupDelay);
        }


        /**
         * Close the connection to the database.
         *
         * @param {Function} callback
         */
        close(callback) {
            this.connection.end((err) => {
                if (err) {
                    callback(new Error("Could not close connection"));
                } else {
                    callback();
                }
            });
        }


        /**
         * Opens a connection to a MySQL database.
         */
        connect() {
            this.connection = mysql.createconnection({
                host: this.config.host,
                user: this.config.user,
                password: this.config.password,
                database: this.config.name
            });

            this.connection.connect(callbackHandler);
        }


        /**
         * Deletes a specific record from the database. If unsuccessful, this
         * will call the command to requeue the record.
         *
         * @param {string} recordId
         */
        deleteData(recordId) {
            this.connection.query(`DELETE FROM ?
                WHERE hash = ?, requeued = false;`,
                [this.config.table, recordId],
                (err, data) => {
                    if (err) {
                        requeue(this, recordId);
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
         */
        getRecord(recordId) {
            this.connection.query(`SELECT *
                FROM ?
                WHERE hash = ?;`,
                [this.config.table, recordId],
                callbackHandler()
            );
        }


        /**
         * Queries the database to get a random record. Returns that random
         * record along with a methods to handle the record.
         */
        checkNow() {
            this.connection.query(`SELECT *
                FROM ?
                ORDER BY RAND()
                LIMIT 0, 1;`,
                [this.config.table],
                (err, record) => {
                    if (err) {
                        return err;
                    }

                    return {
                        heartbeat: heartbeat.bind(null, this, record.hash),
                        message: record.message,
                        requeue: requeue.bind(null, this, record.hash),
                        remove: remove.bind(null, this, record.hash)
                    };
                }
            );
        }


        /**
         * Inserts a record into the database. If the record already exists, it
         * is updated.
         *
         * @param {Object} message
         * @param {string} topic
         * @param {Function} callback
         */
        sendMessage(message, topic, callback) {
            var cycleCounter, ddqBackendInstance, hash, writeRecord;

            cycleCounter = 0;
            // eslint-disable-next-line consistent-this
            ddqBackendInstance = this;
            hash = crypto.create("sha256").update(message).digest("hex");

            /**
             * Inserts a record to the database. If it's unable to do so because
             * the record already exists, it will attempt to update the record.
             *
             * These two steps, inserting the record and, on error, updating the
             * record, will repeat as many times as are defined in the config's
             * createMessageCycleLimit.
             */
            function trySendMessage() {
                if (cycleCounter < ddqBackendInstance.config.createMessageCycleLimit) {
                    cycleCounter += 1;
                    ddqBackendInstance.connection.query(`INSERT INTO ? (hash, messageBase64, topic)
                        VALUES (?, ?, ?);`,
                        [ddqBackendInstance.config.table, hash, message.messageBase64, topic],
                        (err) => {
                            if (err) {
                                console.err("Message already exists.");
                                console.err("Attempting to update existing record now.");
                                writeRecord();
                            } else {
                                callback();
                            }
                        }
                    );
                } else {
                    callback(new Error("Could not send message"));
                }
            }

            writeRecord = function () {
                ddqBackendInstance.connection.query(`UPDATE ?
                    SET requeued = true
                    WHERE hash = ?, isProcessing = true;`,
                    [ddqBackendInstance.config.table, hash],
                    (err) => {
                        if (err) {
                            trySendMessage(hash);
                        } else {
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
            this.startPolling();
        }


        /**
         * Clears the timers to stop polling.
         */
        pausePolling() {
            timers.clearInterval(this.poller);
            this.poller = null;
        }


        /**
         * Starts polling.
         */
        resumePolling() {
            this.startPolling();
        }


        /**
         * Polls for a random record at the interval defined by the
         * config.cycleInterval.
         */
        poll() {
            this.poller = timers.setInterval(() => {
                this.connection.query(`SELECT hash
                    FROM ?
                    WHERE isProcessing = false
                    ORDER BY RAND()
                    LIMIT 1;`,
                    [this.config.table],
                    callbackHandler()
                );
            }, this.config.cycleInterval);
        }
    }

    return new DdqBackendMySql(config);
};
