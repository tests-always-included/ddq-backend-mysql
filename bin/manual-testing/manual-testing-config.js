"use strict";

module.exports = () => {
    var config;

    config = {
        backend: "mysql/lib/index",
        pollingRate: 1000,
        createMessageCycleLimitMs: 10,
        pollDelayMs: 500,
        heartbeatCleanupDelayMs: 1000,
        heartbeatLifetimeSeconds: 5,
        host: "localhost",
        database: "pluginSandbox",
        port: 3306,
        table: "queue",
        topics: ["SomeTopic", "blahblah", "Test Topic"],
        user: "root"
    };

    return config;
};

