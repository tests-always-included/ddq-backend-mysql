"use strict";

var config, Plugin;

config = require("./manual-testing-config");

Plugin = require("../../lib/index")(config);

/**
 * Wrapper for tests. In this case, only sendMessage...
 *
 * @param {Function} fn
 * @param {Function} done
 */
function manualTest(fn, done) {
    var instance;

    instance = new Plugin();

    instance.connect((connectErr) => {
        if (connectErr) {
            console.log("There was a connection error");
            done(connectErr);

            return;
        }

        console.log("Connection was successfully made");
        fn(instance, (testErr) => {
            if (testErr) {
                done(testErr);

                return;
            }

            instance.disconnect((disconnectErr) => {
                done(disconnectErr);

                return;
            });
        });
    });
}

// .sendMessage
manualTest((instance, done) => {
    instance.sendMessage("Test Message", "Test Topic", (err) => {
        console.log("Test Callback");
        done(err);
    });
}, (err) => {
    if (err) {
        console.log("sendMessage test failed");
        throw new Error(err);
    } else {
        console.log("sendMessage test passed");
    }
});
