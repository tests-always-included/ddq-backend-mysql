"use strict";

describe("lib/ddq-backend-mysql", () => {
    var instance, mysqlMock, timersMock;

    beforeEach(() => {
        var config, configValidationMock, crypto, EventEmitterMock,
            Plugin;

        config = {
            createMessageCycleLimitMs: 10,
            pollDelayMs: 5000,
            heartbeatCleanupDelayMs: 5000,
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
        beforeEach(() => {
            spyOn(instance, "emit");
            instance.connect(() => {});
        });
        it("emits an error", () => {
            instance.connection.query.andCallFake((query, options, callback) => {
                callback({
                    Error: "Some Error"
                });
            });
            instance.checkNow();
            expect(instance.emit).toHaveBeenCalledWith("error", {
                Error: "Some Error"
            });
        });
        it("emits a wrapper message", () => {
            instance.connection.query.andCallFake((query, options, callback) => {
                callback(null, [
                    {
                        hash: 12345,
                        messageBase64: 12345,
                        topic: "Some Topic"
                    }
                ]);
            });
            instance.checkNow();
            expect(instance.emit).toHaveBeenCalledWith("data", {
                heartbeat: jasmine.any(Function),
                message: 12345,
                requeue: jasmine.any(Function),
                remove: jasmine.any(Function),
                topic: "Some Topic"
            });
        });
    });
    describe(".connect", () => {
        it("creates a MySQL connection", () => {
            instance.connect(() => {});
            expect(mysqlMock.createConnection).toHaveBeenCalledWith(jasmine.any(Object));
        });
        it("throws an error if there's a problem creating the connection", () => {
            instance.connect(() => {});
            instance.connection.connect.andCallFake((callback) => {
                callback({
                    Error: "Some Error"
                });
            });

            expect(() => {
                instance.connect(() => {});
            }).toThrow();
        });
        it("doesn't utilize connection options if they are falsy", () => {
            instance.config.database = null;

            instance.connect(() => {});
        });
    });
    // describe(".deleteData", () => {
    //     it("emits data", () => {
    //         spyOn(instance, "emit");
    //         instance.connect(() => {});
    //         instance.deleteData(123);
    //         expect(instance.connection.query).toHaveBeenCalled();
    //         expect(instance.emit).toHaveBeenCalledWith("data", jasmine.any(Function));
    //     });
    //     it("emits an error", () => {
    //         spyOn(instance, "emit");
    //         instance.connect(() => {});
    //         instance.deleteData(321);
    //         expect(instance.emit).toHaveBeenCalledWith("error", {
    //             Error: "Some Error"
    //         });
    //     });
    // });
    describe(".disconnect", () => {
        it("ends the connection", () => {
            instance.connect(() => {});
            instance.disconnect(() => {});
            expect(instance.connection.end).toHaveBeenCalledWith(jasmine.any(Function));
        });
    });
    describe(".listen", () => {
        beforeEach(() => {
            instance.currentlyPolling = false;
            instance.connect(() => {});
        });
        it("Sets the flag and calls functions", () => {
            expect(instance.poller).toBe(null);
            expect(instance.restorer).toBe(null);
            instance.listen();
            expect(instance.currentlyPolling).toBe(true);
            expect(instance.poller).not.toEqual(false);
            expect(instance.restorer).not.toEqual(false);
        });
    });
    describe(".pausePolling", () => {
        it("clears the timeout and sets the flags", () => {
            instance.poller = true;
            instance.restorer = true;
            instance.currentlyPolling = true;
            instance.listen();
            instance.pausePolling();
            expect(instance.poller).toBe(null);
            expect(instance.restorer).toBe(null);
            expect(instance.currentlyPolling).toBe(false);
            expect(timersMock.clearTimeout).toHaveBeenCalled();
        });
    });
    describe(".resumePolling", () => {
        beforeEach(() => {
            instance.currentlyPolling = false;
            instance.connect(() => {});
        });
        it("Sets the flag and calls functions", () => {
            expect(instance.poller).toBe(null);
            expect(instance.restorer).toBe(null);
            instance.resumePolling();
            expect(instance.currentlyPolling).toBe(true);
            expect(instance.poller).not.toEqual(false);
            expect(instance.restorer).not.toEqual(false);
        });
    });
    describe(".sendMessage", () => {
        beforeEach(() => {
            spyOn(instance, "emit");
            instance.connect(() => {});
        });
        describe("checkRecord()", () => {
            it("emits an error", () => {
                instance.connection.query.andCallFake((query, option, callback) => {
                    callback({
                        Code: "ER_DUP_ENTRY"
                    });
                });
                instance.sendMessage("Example Message", "Example Topic", () => {});
            });
        });
        describe("trySendMessage()", () => {
            it("emits an error", () => {
                instance.connection.query.andCallFake((query, option, callback) => {
                    callback({
                        Error: "Some Error"
                    });
                });
                instance.sendMessage("Example Message", "Example Topic", () => {});
                expect(instance.emit).toHaveBeenCalledWith("error", {
                    Error: "Some Error"
                });
            });
            it("throws an error", () => {
                expect(() => {
                    instance.sendMessage();
                }).toThrow(Error("Could not send message"));
            });
        });
        describe("writeRecord()", () => {
            it("emits an error", () => {
                instance.sendMessage();
                expect(instance.emit).toHaveBeenCalled("error", {
                    Error: "Some Error"
                });
            });
        });
    });
});
