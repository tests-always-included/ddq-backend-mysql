"use strict";

describe("lib/ddq-backend-mysql", () => {
    var instance, mysqlMock;

    beforeEach(() => {
        var config, configValidationMock, crypto, EventEmitterMock,
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
        configValidationMock = jasmine.createSpyObj("configValidationMock", [
            "validateConfig"
        ]);
        crypto = require("crypto");
        EventEmitterMock = require("./mock/event-emitter-mock")();
        mysqlMock = require("./mock/mysql-mock")();
        timersMock = require("./mock/timersMock")();

        Plugin = require("../../lib/ddq-backend-mysql")(config, configValidationMock, crypto, EventEmitterMock, mysqlMock, timersMock);
        instance = new Plugin();
    });
    describe(".checkNow", () => {

    });
    describe(".connect", () => {
        it("creates a MySQL connection", () => {
            instance.connect(() => {});
            expect(mysqlMock.createConnection).toHaveBeenCalledWith(jasmine.any(Object));
        });
        // it("throws an error if there's a problem creating the connection", () => {
        //     instance.connect(() => {});
        //     expect(instance.connection).toThrow();
        // });
    });
    describe(".delete", () => {


    });
    describe(".disconnect", () => {
        it("ends the connection", () => {
            instance.connect(() => {});
            instance.disconnect(() => {});
            expect(instance.connection.end).toHaveBeenCalledWith(jasmine.any(Function));
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
