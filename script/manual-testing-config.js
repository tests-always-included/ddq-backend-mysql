"use strict";

module.exports = {
    backend: "mysql/lib/index",
    createMessageCycleLimit: 10,
    pollingDelayMs: 500,
    heartbeatCleanupDelayMs: 1000,
    heartbeatLifetimeSeconds: 5,
    host: "localhost",
    database: "testQueue",
    port: 3306,
    table: "queue",
    topics: [
        "SomeTopic",
        "blahblah",
        "Test Topic",
        null
    ],
    user: "root"
};
