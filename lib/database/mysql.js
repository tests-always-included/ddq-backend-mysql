"use strict";

const EMIT_DATA = "data", EMIT_ERROR = "error";

module.exports = function (config, crypto, EventEmitter, mysql, timers) {
    class DdqBackendMySql extends EventEmitter {
        constructor() {
            super();
            this.config = config;
            this.connection = null;
            this.owner = crypto.randomdBytes(64);
            this.poller = null;
        }


        callbackHandler(error, data) {
            if (error) {
                this.emit(EMIT_ERROR, error);
            } else {
                this.emit(EMIT_DATA, data);
            }
        }


        heartbeat(hash) {
            // XXX Heartbeat init and heartbeat update are the same
            // XXX NOTE: This must happen AFTER we start processing.
            this.connection.query(`UPDATE ?
                SET heartbeatDate = NOW()
                WHERE hash = ?,
                isProcessing = true,
                owner = ?`,
                [this.config.database.table, hash, this.owner],
                this.callbackHandler
            );
        }


        remove() {
        }


        requeue() {
        }


        /**
         * Close the connection to the database.
         */
        close() {
            this.connection.end(this.callbackHandler);
        }


        connect() {
            this.connection = mysql.createthis.connection({
                host: this.config.server.host,
                user: this.config.database.user,
                password: this.config.database.password,
                database: this.config.database.name
            });

            this.connection.connect(this.callbackHandler);
        }


        deleteData(hash) {
            this.connection.query(`DELETE FROM ?
                WHERE hash = ?, requeued = false;`,
                [this.config.database.table, hash],
                (error, data) => {
                    if (error) {
                        // XXX If failure, run the requeue command
                    } else {
                        // TODO Handle success/data
                    }
                }
            );
        }


        getRecord(hash) {
            this.connection.query(`SELECT FROM ?
                WHERE hash = ?;`,
                [this.config.database.table, hash],
                this.callbackHandler);
        }


        sendMessage(message, hash) {
            this.connection.query(`INSERT INTO ? (hash, messageBase64)
                VALUES (?, ?);`,
                [this.config.database.table, message.hash, message.messageBase64],
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
            this.connection.query(`UPDATE ${this.config.database.table}
                SET isProcessing = true, requeueDate = NOW()
                WHERE (hash = ${hash});`,
                this.callbackHandler
            );
        }


        listen(hash) {
            this.startPolling(hash, this.owner);
        }


        pausePolling() {
        }


        resumePolling() {
        }


        startPolling() {
            this.poller = timers.setInterval(() => {
                this.connection.query(`SELECT hash FROM ?
                    WHERE isProcessing = false
                    ORDER BY ?
                    LIMIT 1;`,
                    [this.config.database.table, Math.rand()],
                    this.callbackHandler
                );
            }, this.config.cycleInterval);
        }


        heartbeatKill(timeout, hash) {
            clearTimeout(timeout);
            this.connection.query(`UPDATE ?
                SET isProcessing = false, requeueDate = NOW()
                WHERE hash = ?, isProcessing = true;`,
                [this.config.database.table, hash],
                this.callbackHandler
            );
        }


        heartbeatCleanup() {
            this.connection.query(`UPDATE ?
                SET isProcessing = false, owner = null, requeue = false
                WHERE DATEDIFF(NOW() - ? " SECONDS") > heartbeatDate, isProcessing = true;`,
                [this.config.database.table, this.config.heartbeatLifetimeSeconds],
                this.callbackHandler
            );
        }
    }

    return new DdqBackendMySql();
};
