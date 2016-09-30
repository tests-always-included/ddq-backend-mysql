"use strict";

describe("lib/ddq-backend-mysql", () => {
    var instance, mysqlMock, timersMock;

    beforeEach(() => {
        var config, configValidationMock, crypto, EventEmitterMock,
            Plugin;

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
        EventEmitterMock = require("../mock/event-emitter-mock")();
        mysqlMock = require("../mock/mysql-mock")();
        timersMock = require("../mock/timersMock")();

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
        it("", () => {
            instance.connect(() => {});
            instance.getRecord(123, () => {});
            expect(instance.connection.query).toHaveBeenCalled();
        });
    });
    describe(".listen", () => {
        beforeEach(() => {
            instance.currentlyPolling = false;
            spyOn(instance, "poll");
        });
        it("Sets the flag and calls functions", () => {
            expect(instance.restorer).toBe(null);
            instance.listen();
            expect(instance.currentlyPolling).toBe(true);
            expect(instance.poll).toHaveBeenCalled();
            expect(instance.restorer).not.toBe(null);
        });
    });
    describe(".pausePolling", () => {
        it("clears the timeout and sets the flags", () => {
            spyOn(instance, "poll").andCallFake(() => {
                instance.poller = true;
                instance.restorer = true;
                instance.currentlyPolling = true;
            });
            instance.poll();
            instance.pausePolling();
            expect(instance.poller).toBe(null);
            expect(instance.restorer).toBe(null);
            expect(instance.currentlyPolling).toBe(false);
            expect(timersMock.clearTimeout).toHaveBeenCalled();
        });
    });
    describe(".poll", () => {

    });
    describe(".resumePolling", () => {
        it("sets the flag and calls .poll", () => {
            expect(instance.currentlyPolling).toBe(false);
            spyOn(instance, "poll");
            instance.resumePolling();
            expect(instance.poll).toHaveBeenCalled();
            expect(instance.currentlyPolling).toBe(true);
        });
    });
    describe(".sendMessage", () => {
    });
    describe(".setHeartbeat", () => {
    });
});
