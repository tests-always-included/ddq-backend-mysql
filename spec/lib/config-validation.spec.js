"use strict";

describe("lib/config-validation", () => {
    var config, configValidation;

    beforeEach(() => {
        configValidation = require("../../lib/config-validation.js")();
        spyOn(configValidation, "validateConfig").andCallThrough();
    });
    describe(".validateConfig", () => {
        describe("topic handling:", () => {
            it("throws an error if topics is not an array, string or null", () => {
                config = {
                    createMessageCycleLimit: 1000,
                    pollingDelayMs: 1000,
                    heartbeatCleanupDelayMs: 50000,
                    heartbeatLifetimeSeconds: 5,
                    table: "exampleTable",
                    topics: {
                        topic1: "SomeValue",
                        topic2: "AnotherValue"
                    }
                };
                expect(() => {
                    configValidation.validateConfig(config);
                }).toThrow();
            });
            it("throws an error if a topics array contains invalid types", () => {
                config = {
                    createMessageCycleLimit: 1000,
                    pollingDelayMs: 1000,
                    heartbeatCleanupDelayMs: 50000,
                    heartbeatLifetimeSeconds: 5,
                    table: "exampleTable",
                    topics: [
                        {
                            topic1: "SomeValue"
                        },
                        [
                            "More",
                            "Topics"
                        ]
                    ]
                };
                expect(() => {
                    configValidation.validateConfig(config);
                }).toThrow();
            });
            it("accepts arrays of strings and NULL", () => {
                config = {
                    createMessageCycleLimit: 1000,
                    pollingDelayMs: 1000,
                    heartbeatCleanupDelayMs: 50000,
                    heartbeatLifetimeSeconds: 5,
                    table: "exampleTable",
                    topics: [
                        "SomeValue",
                        "AnotherValue",
                        null
                    ]
                };
                expect(() => {
                    configValidation.validateConfig(config);
                }).not.toThrow();
            });
        });
        it("throws an error if the config is not an object", () => {
            config = false;
            expect(() => {
                configValidation.validateConfig(config);
            }).toThrow();
        });
        it("throws an error if any of the configKeys are missing", () => {
            config = {
                createMessageCycleLimit: 1000,
                pollingDelayMs: 1000,
                heartbeatCleanupDelayMs: 50000,
                topics: "SomeTopic"
            };
            expect(() => {
                configValidation.validateConfig(config);
            }).toThrow();
        });
        it("throws if required config values are of the wrong type", () => {
            config = {
                createMessageCycleLimit: {
                    limit: 10
                },
                pollingDelayMs: 1000,
                heartbeatCleanupDelayMs: 50000,
                heartbeatLifetimeSeconds: 5,
                table: "exampleTable",
                topics: "SomeTopic"
            };
            expect(() => {
                configValidation.validateConfig(config);
            }).toThrow();
        });
        it("accepts a valid config", () => {
            config = {
                createMessageCycleLimit: 1000,
                pollingDelayMs: 1000,
                heartbeatCleanupDelayMs: 50000,
                heartbeatLifetimeSeconds: 5,
                table: "exampleTable",
                topics: "SomeTopic"
            };
            expect(() => {
                configValidation.validateConfig(config);
            }).not.toThrow();
        });
    });
});
