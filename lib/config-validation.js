"use strict";

module.exports = () => {
    /**
     * Checks that the config has at least the bare minimum to work with the
     * backend-plugin. It will fail loudly if it doesn't.
     *
     * @param {Object} config
     * @param {Function} callback
     */
    function validateConfig(config) {
        var configKeys;

        if (typeof config !== "object") {
            throw new Error("Config must be an object.");
        }

        configKeys = [
            "createMessageCycleLimitMs",
            "pollDelayMs",
            "heartbeatCleanupDelayMs",
            "heartbeatLifetimeSeconds",
            "host",
            "table"
        ];

        configKeys.forEach((key) => {
            if (!config[key]) {
                throw new Error(`Config.${key} must be defined.`);
            }
        });
    }

    return {
        validateConfig
    };
};
