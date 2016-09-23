"use strict";

const EMIT_DATA = "data", EMIT_err = "err";

module.exports = function (config, crypto, EventEmitter, mysql, timers) {


    function heartbeat(ddqBackendInstance, hash, callback) {
        // XXX Heartbeat init and heartbeat update are the same
        // XXX NOTE: This must happen AFTER we start processing.
        ddqBackendInstance.connection.query(`UPDATE ?
            SET heartbeatDate = NOW()
            WHERE hash = ?,
            isProcessing = true,
            owner = ?;`,
            [ddqBackendInstance.config.table, hash, ddqBackendInstance.owner],
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
            ddqBackendInstance.emit(EMIT_err, err);
        } else {
            ddqBackendInstance.emit(EMIT_DATA, data);
        }
    }


    function heartbeatKill(ddqBackendInstance, hash) {
        ddqBackendInstance.connection.query(`UPDATE ?
            SET isProcessing = false, requeued = true
            WHERE hash = ?, isProcessing = true;`,
            [ddqBackendInstance.config.table, hash],
            callbackHandler()
        );
    }


    /**
     * Calls method to delete entry.
     *
     * @param {Object} ddqBackendInstance
     * @param {string} hash
     */
    function remove(ddqBackendInstance, hash) {
        ddqBackendInstance.deleteData(hash);
    }


    function requeue(ddqBackendInstance, hash) {
        ddqBackendInstance.connection.query(`UPDATE ?
            SET owner = null, isProcessing = false, requeued = true
            WHERE hash = ?;`,
            [ddqBackendInstance.config.table, hash],
            ddqBackendInstance.callbackHandler
        );
    }


    class DdqBackendMySql extends EventEmitter {
        /**
         * Default DdqBackendMySql properties.
         *
         * @param {Object} config
         */
        constructor(backendConfig) {
            super();
            this.config = backendConfig;
            this.connection = null;
            this.owner = crypto.randomdBytes(64);
            this.poller = null;
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
                host: this.config.server.host,
                user: this.config.database.user,
                password: this.config.database.password,
                database: this.config.database.name
            });

            this.connection.connect(callbackHandler);
        }


        deleteData(hash) {
            this.connection.query(`DELETE FROM ?
                WHERE hash = ?, requeued = false;`,
                [this.config.table, hash],
                (err, data) => {
                    if (err) {
                        // XXX If failure, run the requeue command
                    } else {
                        // TODO Handle success/data
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
                callbackHandler);
        }


        getWrappedMessage() {
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
                        heartbeatKill: heartbeatKill.bind(null, this,
                            record.hash),
                        message: record.message,
                        requeue: requeue.bind(null, this, record.hash),
                        remove: remove.bind(null, this, record.hash)
                    };
                }
            );
        }


        /**
         * Inserts a record into the database. If the entry already exists, it
         * is updated.
         *
         * @param {Object} message
         * @param {Function} callback
         */
        sendMessage(message, callback) {
            var cycleCounter, ddqBackendInstance, hash;

            cycleCounter = 0;
            ddqBackendInstance = this;
            hash = crypto.create("sha256").update(message).digest("hex");

            function trySendMessage() {
                if (cycleCounter < ddqBackendInstance.config.createMessageCycleLimit) {
                    cycleCounter += 1;
                    ddqBackendInstance.connection.query(`INSERT INTO ? (hash, messageBase64)
                        VALUES (?, ?);`,
                        [ddqBackendInstance.config.table, hash, message.messageBase64],
                        (err) => {
                            if (err) {
                                console.err("Message already exists.");
                                console.err("Attempting to update existing entry now.");
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

            function writeRecord() {
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
            }

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


        startPolling() {
            this.poller = timers.setInterval(() => {
                this.connection.query(`SELECT hash FROM ?
                    WHERE isProcessing = false
                    ORDER BY ?
                    LIMIT 1;`,
                    [this.config.table, Math.rand()],
                    callbackHandler
                );
            }, this.config.cycleInterval);
        }


        heartbeatCleanup() {
            this.connection.query(`UPDATE ?
                SET isProcessing = false, owner = null, requeue = false
                WHERE DATEDIFF(NOW() - ? " SECONDS") > heartbeatDate, isProcessing = true;`,
                [this.config.table, this.config.heartbeatLifetimeSeconds],
                callbackHandler
            );
        }
    }

    return new DdqBackendMySql(config);
};
