"use strict";

module.exports = () => {
    /**
     * Checks that the config has all necessary properties to work with the
     * backend-plugin. It will fail loudly if something isn't present.
     *
     * @param {Object} config
     * @param {Function} callback
     */
    function validateConfig(config) {
        var configKeys;

        if (typeof config !== "object") {
            throw new Error("Config must be an object.");
        }

        if (Array.isArray(config.topics)) {
            config.topics.forEach((topic) => {
                if (typeof topic !== "string" && topic !== null) {
                    throw new Error(`Topics must be either a string or NULL. Inputted type: ${typeof topic}`);
                }
            });
        } else if (typeof config.topics !== "string" && config.topics !== null) {
            throw new Error("Config.topics must an array, string, or NULL");
        }

        configKeys = {
            createMessageCycleLimit: "number",
            deadlockCountLimit: "number",
            pollingDelayMs: "number",
            heartbeatCleanupDelayMs: "number",
            heartbeatLifetimeSeconds: "number",
            table: "string"
        };

        Object.keys(configKeys).forEach((key) => {
            if (!config[key]) {
                throw new Error(`Config.${key} must be defined.`);
            } else if (typeof config[key] !== configKeys[key]) {
                throw new Error(`Config.${key} must be a ${configKeys[key]}`);
            }
        });
    }

    return {
        validateConfig
    };
};
