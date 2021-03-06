"use strict";

describe("lib/ddq-backend-mysql", () => {
    var EventEmitter, instance, mysqlMock, Plugin, timersMock;

    beforeEach(() => {
        var config, configValidationMock, crypto, debug;

        config = {
            createMessageCycleLimit: 10,
            deadlockCountLimit: 2,
            pollingDelayMs: 1000,
            heartbeatCleanupDelayMs: 5000,
            host: "localhost",
            database: "exampleDatabase",
            port: 3333,
            table: "exampleTable",
            topics: [
                "ExampleTopic1",
                "ExampleTopic2",
                null
            ],
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
        debug = jasmine.createSpy("debug");
        Plugin = require("../../lib/ddq-backend-mysql")(configValidationMock, crypto, debug, EventEmitter, mysqlMock, timersMock);
        instance = new Plugin(config);
        instance.connect(() => {});
        spyOn(instance, "emit");
    });
    describe(".connect()", () => {
        it("creates a MySQL connection", () => {
            instance.connect(() => {});
            expect(mysqlMock.createConnection).toHaveBeenCalledWith(jasmine.any(Object));
        });

        // This test is a bit redundant, as lib/configValidation should throw an
        // error if a connection option is falsy. This provides branch coverage,
        // though.
        it("doesn't utilize connection options if they are falsy", () => {
            instance.config.database = null;
            instance.connect(() => {});
        });
    });
    describe(".disconnect()", () => {
        it("ends the connection", () => {
            instance.disconnect(() => {});
            expect(instance.connection.end).toHaveBeenCalledWith(jasmine.any(Function));
        });
    });
    describe(".startListening()", () => {
        it("sets the flags and calls functions", () => {
            timersMock.setTimeout.and.returnValue(true);
            expect(instance.poller).toBe(null);
            expect(instance.restorer).toBe(null);
            instance.startListening();
            expect(instance.currentlyPolling).toBe(true);
            expect(instance.poller).not.toEqual(false);
            expect(instance.restorer).not.toEqual(false);
            expect(timersMock.setTimeout).toHaveBeenCalled();
        });
    });
    describe(".stopListening()", () => {
        it("clears the timeouts and sets the flags", () => {
            spyOn(instance, "startListening");
            instance.poller = true;
            instance.restorer = true;
            instance.currentlyPolling = true;
            instance.currentlyRestoring = true;
            instance.startListening();
            instance.stopListening();
            expect(instance.poller).toBe(null);
            expect(instance.restorer).toBe(null);
            expect(instance.currentlyPolling).toBe(false);
            expect(instance.currentlyRestoring).toBe(false);
            expect(timersMock.clearTimeout).toHaveBeenCalled();
        });
        it("does nothing if the plugin isn't already listening", () => {
            instance.stopListening();
            expect(timersMock.clearTimeout).not.toHaveBeenCalled();
        });
        it("calls the callback if one is passed", () => {
            var callback;

            callback = jasmine.createSpy();
            instance.stopListening(callback);
            expect(callback).toHaveBeenCalled();
        });
    });
    describe(".poll()", () => {
        describe(".checkNow()", () => {
            beforeEach(() => {
                timersMock.setTimeout.and.callFake((callback) => {
                    if (timersMock.setTimeout.calls.count() === 1) {
                        return;
                    } else if (timersMock.setTimeout.calls.count() === 2) {
                        callback();
                    }
                });
                instance.emit.and.callThrough();
            });
            it("emits on error", (done) => {
                instance.connection.query.and.callFake((query, options, callback) => {
                    callback({
                        Error: "Some Error"
                    });
                });
                instance.on("error", () => {
                    expect(instance.emit).not.toHaveBeenCalledWith("error", {});
                    done();
                });
                instance.startListening();
            });
            it("emits data", (done) => {
                instance.connection.query.and.callFake((query, options, callback) => {
                    callback(null, [
                        {
                            hash: 123,
                            message: "SomeMessage",
                            messageBase64: 456,
                            topic: "SomeTopic"
                        }
                    ]);
                });
                instance.on("data", () => {
                    expect(instance.emit).toHaveBeenCalledWith("data", {
                        heartbeat: jasmine.any(Function),
                        message: "SomeMessage",
                        requeue: jasmine.any(Function),
                        remove: jasmine.any(Function),
                        topic: "SomeTopic"
                    });
                    done();
                });
                instance.startListening();
            });
            it("has no data to emit", (done) => {
                instance.connection.query.and.callFake((query, options, callback) => {
                    callback(null, []);
                });
                instance.startListening();
                expect(instance.emit).not.toHaveBeenCalled();
                done();
            });
            it("fails on update", (done) => {
                timersMock.setTimeout.and.callFake((callback, time) => {
                    // Hacky method of only calling for polling.
                    if (time === 1000 && timersMock.setTimeout.calls.count() < 4) {
                        callback();
                    }
                });
                instance.connection.query.and.callFake((query, opts, callback) => {
                    if (instance.connection.query.calls.count() === 2) {
                        callback(new Error("FAILED TO UPDATE"));
                    } else {
                        callback(null, [
                            {
                                hash: 123,
                                message: "SomeMessage",
                                messageBase64: 456,
                                topic: "SomeTopic"
                            }
                        ]);
                    }
                });
                instance.on("data", () => {
                    expect(instance.connection.query.calls.count()).toBe(4);
                    instance.currentlyPolling = false;
                    done();
                });
                instance.startListening();
            });
            it("stops listening if the flag isn't set", (done) => {
                instance.connection.query.and.callFake((query, options, callback) => {
                    instance.currentlyPolling = false;
                    callback(null, [
                        {
                            hash: 123,
                            message: "SomeMessage",
                            messageBase64: 456,
                            topic: "SomeTopic"
                        }
                    ]);
                });
                instance.on("data", () => {
                    expect(timersMock.setTimeout.calls.count()).toBe(2);
                    done();
                });
                instance.startListening();
            });
            it("gets deadlock but continues on", (done) => {
                var err;

                err = new Error("Deadlock");
                err.code = "ER_LOCK_DEADLOCK";

                timersMock.setTimeout.and.callFake((callback, time) => {
                    // Hacky method of only calling for polling.
                    if (time === 1000 && timersMock.setTimeout.calls.count() < 4) {
                        callback();
                    }
                });
                instance.connection.query.and.callFake((query, options, callback) => {
                    if (instance.connection.query.calls.count() === 1) {
                        callback(err, null);
                    } else {
                        callback(null, [
                            {
                                hash: 123,
                                message: "SomeMessage",
                                messageBase64: 456,
                                topic: "SomeTopic"
                            }
                        ]);
                    }
                });
                instance.on("data", () => {
                    expect(timersMock.setTimeout.calls.count()).toBe(3);
                    expect(instance.connection.query.calls.count()).toBe(3);
                    done();
                });
                instance.startListening();
            });
        });
    });
    describe(".sendMessage()", () => {
        it("calls trySendMessage", () => {
            instance.connection.query.and.callFake((query, option, callback) => {
                callback();
            });
            instance.sendMessage("Example Message", "Some Topic", () => {});
        });
        describe(".trySendMessage()", () => {
            it("empty topic", () => {
                instance.connection.query.and.callFake((query, option, callback) => {
                    callback({
                        Error: "Some Error"
                    });
                });
                instance.sendMessage("Example Message", "", () => {});
            });
            it("throws an error", () => {
                instance.config.createMessageCycleLimit = 0;
                expect(() => {
                    instance.sendMessage("Example Message", null, (err) => {
                        throw err;
                    });
                }).toThrow(Error("Could not send message."));
            });
        });
        describe(".setRequeued()", () => {
            it("calls trySendMessage if zero rows are affected by query", () => {
                instance.connection.query.and.callFake((query, option, callback) => {
                    if (instance.connection.query.calls.count() === 2) {
                        callback(null, {
                            affectedRows: 0
                        });
                    } else {
                        callback({
                            code: "ER_DUP_ENTRY"
                        });
                    }
                });
                instance.sendMessage("Example Message", null, () => {});
            });
            it("calls the callback on success", () => {
                instance.connection.query.and.callFake((query, option, callback) => {
                    if (instance.connection.query.calls.count() === 2) {
                        callback(null, () => {});
                    } else {
                        callback({
                            code: "ER_DUP_ENTRY"
                        });
                    }
                });
                instance.sendMessage("Example Message", null, () => {});
            });
        });
    });
    describe("wrapped message functions:", () => {
        beforeEach(() => {
            timersMock.setTimeout.and.callFake((callback) => {
                if (timersMock.setTimeout.calls.count() === 1) {
                    return;
                } else if (timersMock.setTimeout.calls.count() === 2) {
                    callback();
                }
            });
            instance.emit.and.callThrough();
            instance.connection.query.and.callFake((query, options, callback) => {
                callback(null, [
                    {
                        hash: 123,
                        message: 456,
                        topics: [
                            "some",
                            "topics"
                        ]
                    }
                ]);
            });
        });
        describe(".heartbeat()", () => {
            it("will call the provided callback", (done) => {
                var cbSpy;

                instance.on("data", (wrappedMessage) => {
                    wrappedMessage.heartbeat(() => {});
                    expect(instance.connection.query.calls.count()).toBe(3);
                    done();
                });
                cbSpy = jasmine.createSpy("callback");
                instance.startListening(cbSpy);
                expect(cbSpy).toHaveBeenCalled();
            });
        });
        describe(".requeue()", () => {
            it("will call the provided callback", (done) => {
                instance.on("data", (wrappedMessage) => {
                    wrappedMessage.requeue(() => {});
                    expect(instance.connection.query.calls.count()).toBe(3);
                    done();
                });
                instance.startListening();
            });
        });
        describe(".remove()", () => {
            it("will call the provided callback", (done) => {
                instance.on("data", (wrappedMessage) => {
                    wrappedMessage.remove(() => {});
                    expect(instance.connection.query.calls.count()).toBe(3);
                    done();
                });
                instance.startListening();
            });
            it("will call requeue on error", (done) => {
                instance.connection.query.and.callFake((query, options, callback) => {
                    if (instance.connection.query.calls.count() <= 2) {
                        callback(null, [
                            {
                                hash: 123,
                                message: 456,
                                topics: [
                                    "some",
                                    "topics"
                                ]
                            }
                        ], {
                            affectedRows: 1
                        });
                    } else if (instance.connection.query.calls.count() > 2) {
                        callback({
                            Error: "Some Error"
                        }, {
                            affectedRows: 0
                        });
                    }
                });
                instance.on("data", (wrappedMessage) => {
                    wrappedMessage.remove(() => {});
                    expect(instance.connection.query.calls.count()).toBe(4);
                    done();
                });
                instance.startListening();
            });
        });
    });
    describe(".restore()", () => {
        describe(".heartbeatCleanup", () => {
            beforeEach(() => {
                timersMock.setTimeout.and.callFake((callback) => {
                    if (timersMock.setTimeout.calls.count() === 1) {
                        callback();
                    } else if (timersMock.setTimeout.calls.count() === 2) {
                        return;
                    }
                });
                instance.emit.and.callThrough();
            });
            it("emits on error", (done) => {
                instance.connection.query.and.callFake((query, queryOptions, callback) => {
                    callback({
                        Error: "Some Error"
                    });
                });
                instance.on("error", () => {
                    expect(instance.emit).toHaveBeenCalledWith("error", {
                        Error: "Some Error"
                    });
                    done();
                });
                instance.startListening();
            });
            it("doesn't emit on success and stops restoring after one round", (done) => {
                // After switching to Jasmine 2 this branch was exposed as not
                // being tested.
                timersMock.setTimeout.and.callFake((callback) => {
                    if (timersMock.setTimeout.calls.count() < 3) {
                        instance.currentlyRestoring = false;
                        callback();
                    } else {
                        expect(instance.emit.calls.count()).toBe(0);
                        done();
                    }
                });
                instance.connection.query.and.callFake((query, queryOptions, callback) => {
                    callback(null, []);
                });
                instance.startListening();
            });
            it("stops restoring if the flag isn't set", (done) => {
                instance.connection.query.and.callFake((query, options, callback) => {
                    instance.currentlyRestoring = false;
                    callback({
                        Error: "Some Error"
                    });
                });
                instance.on("error", () => {
                    expect(timersMock.setTimeout.calls.count()).toBe(1);
                    done();
                });
                instance.startListening();
            });
            it("deadlocks and continues", (done) => {
                var err;

                err = new Error("Deadlock");
                err.code = "ER_LOCK_DEADLOCK";

                timersMock.setTimeout.and.callFake((callback, time) => {
                    // Hacky method of only calling for restore.
                    if (time === 5000 && timersMock.setTimeout.calls.count() < 4) {
                        callback();
                    }
                });
                instance.connection.query.and.callFake((query, options, callback) => {
                    if (instance.connection.query.calls.count() === 1) {
                        callback(err, null);
                    } else {
                        callback();
                        done();
                    }
                });
                instance.startListening();
            });
        });
    });
});
