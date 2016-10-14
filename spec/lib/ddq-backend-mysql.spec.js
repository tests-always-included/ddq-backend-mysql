"use strict";

describe("lib/ddq-backend-mysql", () => {
    var EventEmitter, instance, mysqlMock, Plugin, timersMock;

    beforeEach(() => {
        var config, configValidationMock, crypto;

        config = {
            createMessageCycleLimitMs: 10,
            pollingDelayMs: 1000,
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
        EventEmitter = require("events");
        mysqlMock = require("../mock/mysql-mock")();
        timersMock = jasmine.createSpyObj("timersMock", [
            "setTimeout",
            "clearTimeout"
        ]);
        Plugin = require("../../lib/ddq-backend-mysql")(config, configValidationMock, crypto, EventEmitter, mysqlMock, timersMock);
        instance = new Plugin();
        instance.connect(() => {});
        spyOn(instance, "emit");
    });
    describe(".checkNow", () => {
        beforeEach(() => {
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
        it("emits a wrapped message", () => {
            instance.connection.query.andCallFake((query, options, callback) => {
                callback(null, [
                    {
                        hash: 12345,
                        messageBase64: 12345,
                        topics: "Some Topic"
                    }
                ]);
            });
            instance.checkNow();
            expect(instance.emit).toHaveBeenCalledWith("data", {
                heartbeat: jasmine.any(Function),
                message: 12345,
                requeue: jasmine.any(Function),
                remove: jasmine.any(Function),
                topics: "Some Topic"
            });
        });
    });
    describe(".connect", () => {
        it("creates a MySQL connection", () => {
            instance.connect(() => {});
            expect(mysqlMock.createConnection).toHaveBeenCalledWith(jasmine.any(Object));
        });
        it("throws an error if there's a problem creating the connection", () => {
            instance.connection.connect.andCallFake((callback) => {
                callback({
                    Error: "Some Error"
                });
            });
            expect(() => {
                instance.connect(() => {});
            }).toThrow();
        });

        // This test is a bit redundant, as lib/configValidation should throw an
        // error if a connection option is falsy. This provides branch coverage,
        // though.
        it("doesn't utilize connection options if they are falsy", () => {
            instance.config.database = null;
            instance.connect(() => {});
        });
    });
    describe(".disconnect", () => {
        it("ends the connection", () => {
            instance.disconnect(() => {});
            expect(instance.connection.end).toHaveBeenCalledWith(jasmine.any(Function));
        });
    });
    describe(".listen", () => {
        beforeEach(() => {
            instance.currentlyPolling = false;
        });
        it("sets the flags and calls functions", () => {
            timersMock.setTimeout.andReturn(true);
            expect(instance.poller).toBe(null);
            expect(instance.restorer).toBe(null);
            instance.listen(() => {});
            expect(instance.currentlyPolling).toBe(true);
            expect(instance.poller).not.toEqual(false);
            expect(instance.restorer).not.toEqual(false);
            expect(timersMock.setTimeout).toHaveBeenCalled();
        });
    });
    describe(".pausePolling", () => {
        it("clears the timeouts and sets the flags", () => {
            instance.poller = true;
            instance.restorer = true;
            instance.currentlyPolling = true;
            instance.listen(() => {});
            instance.pausePolling();
            expect(instance.poller).toBe(null);
            expect(instance.restorer).toBe(null);
            expect(instance.currentlyPolling).toBe(false);
            expect(timersMock.clearTimeout).toHaveBeenCalled();
        });
    });
    describe(".poll", () => {
        beforeEach(() => {
            timersMock.setTimeout.andCallFake((callback) => {
                if (timersMock.setTimeout.callCount < 2) {
                    callback();
                } else {
                    return;
                }
            });
            instance.connection.query.andCallFake((query, queryOptions, callback) => {
                callback();
            });
        });
        it("calls .findData", () => {
            instance.listen(() => {});
            expect(instance.connection.query).toHaveBeenCalled();
        });
    });
    describe(".resumePolling", () => {
        beforeEach(() => {
            instance.currentlyPolling = false;
        });
        it("sets the flag and calls functions", () => {
            timersMock.setTimeout.andReturn(true);
            expect(instance.poller).toBe(null);
            expect(instance.restorer).toBe(null);
            instance.resumePolling();
            expect(instance.currentlyPolling).toBe(true);
            expect(instance.poller).not.toEqual(false);
            expect(instance.restorer).not.toEqual(false);
            expect(timersMock.setTimeout).toHaveBeenCalled();
        });
    });
    describe(".sendMessage", () => {
        beforeEach(() => {
            spyOn(console, "log");
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
            it("logs if a message already exists", () => {
                instance.connection.query.andCallFake((query, option, callback) => {
                    callback({
                        code: "ER_DUP_ENTRY"
                    });
                });
                instance.sendMessage("Example Message", "Example Topic", () => {});
                expect(instance.emit.callCount).toBe(1);
            });
            it("calls the callback on success", () => {
                instance.connection.query.andCallFake((query, option, callback) => {
                    callback(null);
                });
                instance.sendMessage("Example Message", "Example Topic", () => {
                    console.log("Callback was called.");
                });
            });
            it("throws an error", () => {
                instance.config.createMessageCycleLimitMs = 0;
                expect(() => {
                    instance.sendMessage("Example Message", "Example Topic", (err) => {
                        throw err;
                    });
                }).toThrow(Error("Could not send message."));
            });
        });
        describe("writeRecord()", () => {
            it("emits an error", () => {
                instance.connection.query.andCallFake((query, option, callback) => {
                    callback({
                        code: "ER_DUP_ENTRY"
                    });
                });
                instance.sendMessage("Example Message", "Example Topic", () => {});
                expect(instance.emit).toHaveBeenCalledWith("error", {
                    code: "ER_DUP_ENTRY"
                });
            });
            it("logs if a record does not exist", () => {
                instance.connection.query.andCallFake((query, option, callback) => {
                    if (instance.connection.query.callCount === 2) {
                        callback(null, {
                            affectedRows: 123
                        });
                    } else {
                        callback({
                            code: "ER_DUP_ENTRY"
                        });
                    }
                });
                instance.sendMessage("Example Message", "Example Topic", () => {});
            });
            it("calls the callback on success", () => {
                instance.connection.query.andCallFake((query, option, callback) => {
                    if (instance.connection.query.callCount === 2) {
                        callback(null, {});
                    } else {
                        callback({
                            code: "ER_DUP_ENTRY"
                        });
                    }
                });
                instance.sendMessage("Example Message", "Example Topic", () => {
                    console.log("Callback was called.");
                });
            });
        });
    });
    describe("wrapped message functions:", () => {
        beforeEach(() => {
            spyOn(console, "error");
            instance.emit.andCallThrough();
            instance.connection.query.andCallFake((query, options, callback) => {
                callback(null, [
                    {
                        hash: 123,
                        messageBase64: 456,
                        topics: ["some", "topics"]
                    }
                ]);
            });
        });
        describe("heartbeat", () => {
            it("will call the provided callback", (done) => {
                instance.on("data", (wrappedMessage) => {
                    wrappedMessage.heartbeat(() => {});
                    expect(instance.connection.query.callCount).toBe(2);
                    done();
                });
                instance.checkNow();
            });
            it("will log errors", (done) => {
                instance.connection.query.andCallFake((query, options, callback) => {
                    if (instance.connection.query.callCount === 2) {
                        callback({
                            Error: "Some Error"
                        });
                    } else {
                        callback(null, [
                            {
                                hash: 123,
                                messageBase64: 456,
                                topics: ["some", "topics"]
                            }
                        ]);
                    }
                });
                instance.on("data", (wrappedMessage) => {
                    wrappedMessage.heartbeat(() => {});
                    expect(instance.connection.query.callCount).toBe(2);
                    done();
                });
                instance.checkNow();
            });
        });
        describe("requeue", () => {
            it("will call the provided callback", (done) => {
                instance.on("data", (wrappedMessage) => {
                    wrappedMessage.requeue(() => {});
                    expect(instance.connection.query.callCount).toBe(2);
                    done();
                });
                instance.checkNow();
            });
        });
        describe(".remove", () => {
            it("is silent on success", (done) => {
                instance.on("data", (wrappedMessage) => {
                    wrappedMessage.remove();
                    expect(instance.connection.query.callCount).toBe(2);
                    done();
                });
                instance.checkNow();
            });
            it("calls requeue on error", (done) => {
                instance.connection.query.andCallFake((query, options, callback) => {
                    if (instance.connection.query.callCount === 2) {
                        callback({
                            Error: "Some Error"
                        });
                    } else {
                        callback(null, [
                            {
                                hash: 123,
                                messageBase64: 456,
                                topics: ["some", "topics"]
                            }
                        ]);
                    }
                });
                instance.on("error", () => {});
                instance.on("data", (wrappedMessage) => {
                    wrappedMessage.remove();
                    expect(instance.connection.query.callCount).toBe(3);
                    expect(instance.emit.callCount).toBe(2);
                    done();
                });
                instance.checkNow();
            });
        });
    });
    describe(".restore", () => {
        beforeEach(() => {
            instance.config.pollingDelayMs = 0;
            timersMock.setTimeout.andCallFake((callback, delayMs) => {
                if (delayMs === 0) {
                    return;
                } else if (timersMock.setTimeout.callCount < 3) {
                    callback();
                } else {
                    return;
                }
            });
        });
        it("calls .heartbeatCleanup", () => {
            instance.connection.query.andCallFake((query, queryOptions, callback) => {
                callback();
            });
            instance.listen(() => {});
            expect(instance.connection.query).toHaveBeenCalled();
            expect(instance.emit).not.toHaveBeenCalled();
        });
        it("emits an error", () => {
            instance.connection.query.andCallFake((query, queryOptions, callback) => {
                callback({
                    Error: "Some Error"
                });
            });
            instance.listen(() => {});
            expect(instance.emit).toHaveBeenCalledWith("error", {
                Error: "Some Error"
            });
        });
    });
});
