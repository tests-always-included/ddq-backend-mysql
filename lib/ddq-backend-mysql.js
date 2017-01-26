"use strict";

const EMIT_DATA = "data", EMIT_ERR = "error";

module.exports = (configValidation, crypto, EventEmitter, mysql, timers) => {
    var setRequeued;

    /**
     * Updates heartbeatDate of a specific record and calls the callback that is
     * passed in.
     *
     * This makes it so that the restore function does not think we have been
     * disconnected and makes the message available to be consumed again.
     *
     * Using a more precise timestamp NOW(3) for heartbeat date to make our
     * cleanup times more accurate. If heartbeat lifetime is one second and a
     * record is inserted at x.999 seconds the record is cleaned up in under
     * a second.
     *
     * @param {Object} ddqBackendInstance
     * @param {string} recordId
     * @param {Function} callback
     */
    function heartbeat(ddqBackendInstance, recordId, callback) {
        ddqBackendInstance.connection.query(`
            UPDATE ??
            SET heartbeatDate = NOW(3)
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
        /**
         * The important part of this function is that isProcessing is set to false.
         * This is because poll only finds messages where isProcessing is false.
         * This is the "requeueing" part of this function.
         *
         * We also set "requeue" to false. We do this because we don't need to process this
         * message twice. We only need to process the message again if that message is currently
         * being processed. For this reason, the "requeued" column was created.
         */
        ddqBackendInstance.connection.query(`
            UPDATE ??
            SET owner = null,
                isProcessing = false,
                requeued = false
            WHERE hash = ?
                AND owner = ?`,
            [
                ddqBackendInstance.config.table,
                recordId,
                ddqBackendInstance.owner
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
        /**
         * We check that "requeued" is false because if it is, we don't want to
         * delete the record. Rather, we would like to set it to false so that
         * it gets processed one more time.
         */
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
            ddqBackendInstance.connection.beginTransaction((err) => {
                if (err) {
                    ddqBackendInstance.emit(EMIT_ERR, err);
                }

                // The section that compares RAND() vs 4 / the number of records
                // that are not currently being processed is added as an optimisation.
                // It is much faster to randomly select a smaller subset and the sort
                // them than it is to sort all of them in a random fashion.
                //
                // http://stackoverflow.com/questions/4329396/mysql-select-10-random-rows-from-600k-rows-fast
                ddqBackendInstance.connection.query(`
                    SELECT *
                    FROM ??
                    WHERE isProcessing = false
                        AND RAND() < 4 / (
                            SELECT COUNT(*)
                            FROM ??
                            WHERE isProcessing = false
                            AND topic IN (?)
                        )
                        AND topic IN (?)
                    ORDER BY RAND()
                    LIMIT 1
                    FOR UPDATE`,
                    [
                        ddqBackendInstance.config.table,
                        ddqBackendInstance.config.table,
                        ddqBackendInstance.topics,
                        ddqBackendInstance.topics
                    ], (selErr, record) => {
                        if (selErr) {
                            if (selErr.code === "ER_LOCK_DEADLOCK" && ddqBackendInstance.deadlockCount < ddqBackendInstance.config.deadlockCountLimit) {
                                ddqBackendInstance.deadlockCount += 1;
                            } else {
                                ddqBackendInstance.emit(EMIT_ERR, selErr);
                            }
                        } else if (record.length > 0) {
                            ddqBackendInstance.deadlockCount = 0;

                            /**
                             * If we found a record to process, we claim
                             * it as our own so no other listeners attempt
                             * to process it.
                             */
                            ddqBackendInstance.connection.query(`
                                UPDATE ??
                                SET isProcessing = true,
                                    owner = ?
                                WHERE hash = ?
                                `,
                                [
                                    ddqBackendInstance.config.table,
                                    ddqBackendInstance.owner,
                                    record[0].hash
                                ], (updateErr) => {
                                    if (updateErr) {
                                        ddqBackendInstance.connection.rollback(() => {
                                            ddqBackendInstance.emit(EMIT_ERR, updateErr);
                                        });
                                    } else {
                                        ddqBackendInstance.connection.commit((commitErr) => {
                                            if (commitErr) {
                                                ddqBackendInstance.connection.rollback(() => {
                                                    ddqBackendInstance.emit(EMIT_ERR, commitErr);
                                                });
                                            } else {
                                                /**
                                                 * This section is important. It's what sets up the interface for our
                                                 * data events. We set up a bunch of functions that can be called directly
                                                 * on the "wrappedMessage" which defaults a bunch of parameters to make it
                                                 * easy to use.
                                                 */
                                                wrappedMessage = {
                                                    heartbeat: heartbeat.bind(null, ddqBackendInstance, record[0].hash),
                                                    message: record[0].message,
                                                    requeue: requeue.bind(null, ddqBackendInstance, record[0].hash),
                                                    remove: remove.bind(null, ddqBackendInstance, record[0].hash),
                                                    topic: record[0].topic
                                                };
                                                ddqBackendInstance.emit(EMIT_DATA, wrappedMessage);
                                            }
                                        });
                                    }
                                }
                            );
                        }

                        if (ddqBackendInstance.currentlyPolling === true) {
                            ddqBackendInstance.poller = timers.setTimeout(checkNow, ddqBackendInstance.config.pollingDelayMs);
                        }
                    }
                );
            });
        }

        ddqBackendInstance.poller = timers.setTimeout(checkNow, ddqBackendInstance.config.pollingDelayMs);
    }


    /**
     * This function exists in case a listener becomes unresponsive after claiming
     * a message. We accomplish this by setting a heartbeatDate which is set to either
     * 1. When the message was claimed or 2. the last time heartbeat was called in order
     * to signal that processing this message is taking longer that the heartbeat timeout.
     *
     * This functionality will continue to run in intervals while our listener is listening.
     *
     * @param {Object} ddqBackendInstance
     */
    function restore(ddqBackendInstance) {
        /**
         * Queries for jobs that have stopped and makes them available to be
         * consumed by a listener again.
         */
        function heartbeatCleanup() {
            ddqBackendInstance.restorer = null;

            /**
             * If the heartbeatDate is too old we free up the record by setting
             * the owner to false but also setting isProcessing to false. isProcessing
             * must be false in order for poll to consume the message. This is the
             * important part.
             *
             * We also set requeued to false because we only need to process the latest. We
             * don't need to process it twice.
             *
             * Note the NOW(3), which provides a timestamp with milliseconds.
             * This makes comparisons on the heartbeat date more accurate.
             */
            ddqBackendInstance.connection.query(`
                UPDATE ??
                SET isProcessing = false,
                    owner = null,
                    requeued = false
                WHERE DATE_SUB(NOW(3), INTERVAL ? SECOND) > heartbeatDate
                    AND isProcessing = true`,
                [
                    ddqBackendInstance.config.table,
                    ddqBackendInstance.config.heartbeatLifetimeSeconds
                ], (err) => {
                    if (err) {
                        if (err.code === "ER_LOCK_DEADLOCK" && ddqBackendInstance.deadlockCount < ddqBackendInstance.config.deadlockCountLimit) {
                            ddqBackendInstance.deadlockCount += 1;
                        } else {
                            ddqBackendInstance.emit(EMIT_ERR, err);
                        }
                    } else {
                        ddqBackendInstance.deadlockCount = 0;
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
     * record already exists, it will call the function to update the existing
     * record.
     *
     * Inserting a record will repeat as many times as are defined in the
     * config's createMessageCycleLimit, calling the callback with an error if
     * that limit has been met.
     *
     * @param {Object} ddqBackendInstance
     * @param {Object} params
     * @param {Function} callback
     */
    function trySendMessage(ddqBackendInstance, params, callback) {
        /**
         * cycleCounter exists to limit the amount of retries for updating and
         * inserting the record.
         *
         * setRequeued is called if the record was a duplicate and setRequeued
         * will call trySendMessage if it found there was nothing to update. This
         * scenario may happen in the event a message was removed in between trying
         * to insert and update.
         */
        if (params.cycleCounter < ddqBackendInstance.config.createMessageCycleLimit) {
            params.cycleCounter += 1;
            ddqBackendInstance.connection.query(`
                INSERT INTO ?? (hash, message, topic, heartbeatDate)
                VALUES (?, ?, ?, NOW(3))`,
                [
                    ddqBackendInstance.config.table,
                    params.hash,
                    params.message,
                    params.topic
                ], (err) => {
                    if (err) {
                        /**
                         * The hash is a hash of the message and topic together. It's
                         * how we identify that the message is the same. The duplicate
                         * error is thrown because the hash is the primary key of the
                         * table.
                         */
                        if (err.code === "ER_DUP_ENTRY") {
                            setRequeued(ddqBackendInstance, params, callback);
                        } else {
                            callback(err);
                        }
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
     * The "requeued" column exists because we want to run a job one
     * more time but only if the message is being processed. This is
     * because we always want to process the latest message, but we
     * don't need to process the latest message multiple times.
     *
     * If we don't find the record we were supposed to update we attempt
     * to send the message again. This scenario guards against a timing
     * issue where the record is removed inbetween the insert failing
     * and this update being called.
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
                if (data && data.affectedRows === 0) {
                    trySendMessage(ddqBackendInstance, params, callback);
                } else {
                    callback(err);
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
            this.deadlockCount = 0;
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
         * @param {Function} [callback]
         */
        startListening(callback) {
            this.currentlyRestoring = true;
            this.currentlyPolling = true;
            restore(this);
            poll(this);

            if (callback) {
                callback();
            }
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
         * @param {string} topic
         * @param {Function} callback
         */
        sendMessage(message, topic, callback) {
            var cycleCounter, hash, params;

            cycleCounter = 0;
            hash = crypto.createHash("sha256");
            hash.update(message);

            if (typeof topic === "string" && !topic.length) {
                topic = null;
            }

            if (topic !== null) {
                hash.update(topic);
            }

            hash = hash.digest("hex");

            params = {
                cycleCounter,
                hash,
                message,
                topic
            };

            trySendMessage(this, params, callback);
        }
    }

    return DdqBackendMySql;
};
