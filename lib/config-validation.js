"use strict";

module.exports = () => {
    /**
     * Checks that the config has at least the bare minimum to work with the
     * backend-plugin. It will fail loudly if it doesn't.
     *
     * @param {Object} config
     * @param {Function} callback
     */
    function validateConfig(config, callback) {
        var configKeys;

        if (typeof config !== "object") {
            throw new Error("Config must be an object.");
        }

        configKeys = [
            "createMessageCycleLimit",
            "cycleInterval",
            "heartbeatCleanupDelay",
            "host",
            "table"
        ];

        configKeys.forEach((key) => {
            if (!config[key]) {
                throw new Error(`Config.${key} must be defined.`);
            }

            callback();
        });
    }

    return {
        validateConfig
    };
};
