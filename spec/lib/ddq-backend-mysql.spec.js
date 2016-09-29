"use strict";

describe("lib/ddq-backend-mysql", () => {
    var instance;

    beforeEach(() => {
        var config, configValidation, crypto, EventEmitterMock, mysqlMock,
            Plugin, timersMock;

        config = {
            pollingRate: 1000,
            createMessageCycleLimit: 10,
            delayMs: 5000,
            heartbeatCleanupDelay: 5000,
            host: "localhost",
            database: "exampleDatabase",
            port: 3333,
            table: "exampleTable",
            topics: ["ExampleTopic1", "ExampleTopic2", null],
            user: "exampleUser",
            password: "examplePassword"
        };
        configValidation = require("../../lib/config-validation")();
        crypto = require("crypto");
        EventEmitterMock = require("../mock/event-emitter-mock")();
        mysqlMock = require("../mock/mysql-mock")();
        timersMock = require("../mock/timersMock")();

        Plugin = require("../../lib/ddq-backend-mysql")(config, configValidation, crypto, EventEmitterMock, mysqlMock, timersMock);
        // console.log(Plugin);
        instance = new Plugin();
    });
    describe(".checkNow", () => {

    });
    describe(".connect", () => {

    });
    describe(".delete", () => {

    });
    describe(".disconnect", () => {
        it("ends the connection", () => {
            console.log("here");
            console.log(instance);
            instance.disconnect();
            expect(instance.connection.end).toHaveBeenCalled();
        });
    });
    describe(".getRecord", () => {

    });
    describe(".listen", () => {

    });
    describe(".pausePolling", () => {

    });
    describe(".poll", () => {

    });
    describe(".resumePolling", () => {

    });
    describe(".sendMessage", () => {

    });
    describe(".setHeartbeat", () => {

    });
});
