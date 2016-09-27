"use strict";

const EMIT_DATA = "data", EMIT_ERR = "error";

module.exports = (config, configValidation, crypto, EventEmitter, mysql, timers) => {
    var connection;

    // function checkConnection(ddqBackendInstance) {
    //     if (connection) {
    //         console.log("Check connection 1");
    //         return true;
    //     } else {
    //         console.log("Check connection 2");
    //         ddqBackendInstance.connect();
    //     }
    // }

    /**
     * Updates heartbeatDate of specific record and calls callback that is passed
     * in.
     *
     * @param {Object} ddqBackendInstance
     * @param {string} recordId
     * @param {Function} callback
     */
    function heartbeat(ddqBackendInstance, recordId, callback) {
        connection.query(`UPDATE ??
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
            console.log("ERROR");
            ddqBackendInstance.emit(EMIT_ERR, err);
        } else {
            console.log("SUCCESS");
            console.log(data);
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
        if (connection) {
            connection.query(`UPDATE ??
                SET isProcessing = false, owner = null, requeue = false
                WHERE DATEDIFF(NOW() - ? " SECONDS") > heartbeatDate, isProcessing = true;`,
                [ddqBackendInstance.config.table, ddqBackendInstance.config.heartbeatLifetimeSeconds],
                callbackHandler()
            );
        } else {
            ddqBackendInstance.connect();
            heartbeatCleanup(ddqBackendInstance);
        }
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
        connection.query(`UPDATE ??
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
        constructor() {
            configValidation.validateConfig(config);
            super();
            this.config = config;
            this.currentlyPolling = false;
            this.owner = crypto.randomBytes(64);
            this.poller = null;
            this.topics = config.topics || null;

            setInterval(() => {
                console.log("test");
                heartbeatCleanup(this);
            }, this.config.heartbeatCleanupDelay);
        }


        /**
         * Close the connection to the database.
         *
         * @param {Function} callback
         */
        close(callback) {
            connection.end((err) => {
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

            connection = mysql.createConnection(connectionOptions);
            connection.connect((err) => {
                if (err) {
                    console.log(err);
                    throw new Error("There was an error while attempting to connect to the database.");
                }

                arguments[0]();
            });
        }


        /**
         * Deletes a specific record from the database. If unsuccessful, this
         * will call the command to requeue the record.
         *
         * @param {string} recordId
         */
        deleteData(recordId) {
            connection.query(`DELETE FROM ??
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
            connection.query(`SELECT *
                FROM ??
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
            connection.query(`SELECT *
                FROM ??
                WHERE topic IN ?
                ORDER BY RAND()
                LIMIT 0, 1;`,
                [this.config.table, this.config.topics],
                (err, record) => {
                    if (err) {
                        return err;
                    }

                    return {
                        heartbeat: heartbeat.bind(null, this, record.hash),
                        message: record.message,
                        requeue: requeue.bind(null, this, record.hash),
                        remove: remove.bind(null, this, record.hash),
                        topic: record.topic
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
            hash = crypto.createHash("sha256").update(message).digest("hex");

            /**
             * Inserts a record to the database. If it's unable to do so because
             * the record already exists, it will attempt to update the record.
             *
             * These two steps, inserting the record and, on error, updating the
             * record, will repeat as many times as are defined in the config's
             * createMessageCycleLimit.
             */
            function trySendMessage() {
                if (connection && connection.state === "authenticated") {
                    if (cycleCounter < ddqBackendInstance.config.createMessageCycleLimit) {
                        cycleCounter += 1;
                        connection.query(`INSERT INTO ?? (hash, messageBase64, topic)
                            VALUES (?, ?, ?);`,
                            [ddqBackendInstance.config.table, hash, message, topic],
                            (err) => {
                                if (err) {
                                    console.log(err);
                                    // console.log("Message already exists.");
                                    console.log("Attempting to update existing record now.");
                                    writeRecord();
                                } else {
                                    ddqBackendInstance.close();
                                    // callback();
                                }
                            }
                        );
                    } else {
                        callback(new Error("Could not send message"));
                    }
                } else {
                    ddqBackendInstance.connect(trySendMessage);
                }
            }

            writeRecord = function () {
                connection.query(`UPDATE ??
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
            this.currentlyPolling = true;
            this.poll();
        }


        /**
         * Clears the timers to stop polling.
         */
        pausePolling() {
            this.poller = null;
            this.currentlyPolling = false;
            timers.clearInterval(this.poller);
        }


        /**
         * Starts polling.
         */
        resumePolling() {
            this.currentlyPolling = true;
            this.poll();
        }


        /**
         * Polls for a random record at the interval defined by the
         * config.cycleInterval.
         */
        poll() {
            this.poller = timers.setInterval(() => {
                connection.query(`SELECT hash
                    FROM ??
                    WHERE isProcessing = false, topic IN ?
                    ORDER BY RAND()
                    LIMIT 1;`,
                    [this.config.table, this.config.topics],
                    callbackHandler()
                );
            }, this.config.cycleInterval);
        }
    }

    return new DdqBackendMySql();
};
