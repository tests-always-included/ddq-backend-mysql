"use strict";

module.exports = function (config, crypto, EventEmitter, mysql) {
    var connection;

    function heartbeat(ddqBackendInstance, hash, owner) {
        // XXX Heartbeat init and heartbeat update are the same
        // XXX NOTE: This must happen AFTER we start processing.
        ddqBackendInstance.connection.query(`UPDATE ${config.database.table}
            SET heartbeatDate = NOW()
            WHERE hash = ${hash},
            isProcessing = true,
            owner = ${owner};`,
            (error, data) => {
                if (error) {
                    ddqBackendInstance.emit("error", new Error(error));
                } else {
                    // Handle success/data
                }
            }
        );
    }


    function remove() {
    }


    function requeue() {
    }


    class DdqBackendMySql extends EventEmitter {
        constructor() {
            super();
            this.connection = null;
        }


        getWrappedMessage() {
        }


        /**
         * Close the this.connection to the database.
         */
        close() {
            this.connection.end();
        }


        connect() {
            this.connection = mysql.createthis.connection({
                host: config.server.host,
                user: config.database.user,
                password: config.database.password,
                database: config.database.name
            });

            this.connection.connect();
        }


        deleteData(hash) {
            // XXX delete from queue where hash = $hash and requeued = false
            this.connection.query(`DELETE FROM ${config.database.table}
                WHERE hash = ${hash}, requeued = false;`,
                (error, data) => {
                    if (error) {
                        // XXX If failure, run the requeue command
                    } else {
                        // TODO Handle success/data
                    }
                }
            );
        }


        getId() {
        }


        getRecord() {
        }


        readData() {
        }


        sendMessage(message) {
            // XXX insert into queue (hash, messageBase64) values ($hash, $messageBase64)
            this.connection.query(`INSERT INTO ${config.database.table} (hash, messageBase64)
                VALUES (${message.hash}, ${message.messageBase64});`,
                (error, data) => {
                    if (error) {
                        console.error("Message already exists.");
                        console.error("Attempting to update existing entry now.");
                    } else {
                        // TODO Handle success/data
                    }
                }
            );
        }


        writeRecord(hash) {
            // FIXME Is this where this code should go?
            // XXX update queue set requeueDate = NOW() where hash = $hash and isProcessing = true
            this.connection.query(`UPDATE ${config.database.table}
                SET isProcessing = true, requeueDate = NOW()
                WHERE (hash = ${hash});`,
                (error, data) => {
                    if (error) {
                        // TODO Repeat sendMessage with cyclingInterval as a timeout.
                    } else {
                        // TODO Handle success/data
                    }
                }
            );
        }


        listen(hash, owner) {
            startPolling(hash, owner);
        }


        pausePolling() {
        }


        resumePolling() {
        }


        startPolling(hash, owner) {
            // XXX Select hash from queue where isProcessing = false order by RAND() limit 1
            // XXX If failure (not 0 records but an actual failure), emit erroror event.
            this.connection.query(`SELECT hash FROM ${config.database.table}
                WHERE isProcessing = false
                ORDER BY ${Math.rand()}
                LIMIT 1;`,
                (error, data) => {
                    if (error) {
                        this.emit("error", new Error(error));
                    } else {
                        // TODO Handle success/data
                    }
                }
            );
        }


        heartbeatKill(timeout, hash) {
            clearTimeout(timeout);
            this.connection.query(`UPDATE ${config.database.table}
                SET isProcessing = false, requeueDate = NOW()
                WHERE hash = ${hash}, isProcessing = true;`,
                (err, data) => {
                    if (err) {
                        // TODO Handle error
                    } else {
                        // TODO Handle success/data
                    }
                }
            );
        }


        heartbeatCleanup() {
            this.connection.query(`UPDATE ${config.database.table}
                SET isProcessing = false, owner = null, requeue = false
                WHERE DATEDIFF(NOW() - ${config.heartbeatLifetimeSeconds} " SECONDS") > heartbeatDate, isProcessing = true;`,
                (err, data) => {
                    if (err) {
                        // TODO Handle error
                    } else {
                        // TODO Handle success/data
                    }
                }
            );
        }
    }

    return new DdqBackend();
};
