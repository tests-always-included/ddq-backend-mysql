"use strict";

describe("lib/config-validation", () => {
    var config, configValidation;

    beforeEach(() => {
        configValidation = require("../../lib/config-validation.js")();
        spyOn(configValidation, "validateConfig").andCallThrough();
    });
    describe(".validateConfig", () => {
        it("throws an error if the config is not an object", () => {
            config = false;
            expect(() => {
                configValidation.validateConfig(config);
            }).toThrow();
        });
        it("throws an error if any of the configKeys are missing", () => {
            config = {
                createMessageCycleLimitMs: 1000,
                pollDelayMs: 1000,
                heartbeatCleanupDelay: 50000,
                host: "localhost"
            };
            expect(() => {
                configValidation.validateConfig(config);
            }).toThrow();
        });
        it("doesn't throw when given a valid config", () => {
            config = {
                createMessageCycleLimitMs: 1000,
                pollDelayMs: 1000,
                heartbeatCleanupDelayMs: 50000,
                heartbeatLifetimeSeconds: 5,
                host: "localhost",
                table: "exampleTable"
            };
            expect(() => {
                configValidation.validateConfig(config);
            }).not.toThrow();
        });
    });
});
