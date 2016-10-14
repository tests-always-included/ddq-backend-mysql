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
                createMessageCycleLimit: 1000,
                pollingDelayMs: 1000,
                heartbeatCleanupDelayMs: 50000
            };
            expect(() => {
                configValidation.validateConfig(config);
            }).toThrow();
        });
        it("doesn't throw when given a valid config", () => {
            config = {
                createMessageCycleLimit: 1000,
                pollingDelayMs: 1000,
                heartbeatCleanupDelayMs: 50000,
                heartbeatLifetimeSeconds: 5,
                table: "exampleTable"
            };
            expect(() => {
                configValidation.validateConfig(config);
            }).not.toThrow();
        });
    });
});
