"use strict";

var config, Plugin;

config = require("./manual-testing-config");
Plugin = require("..")(config);

/**
 * Instantiate a Plugin and call the passed function after establishing a
 * connection. Call the done callback on any returned values and disconnect on
 * success.
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

            instance.disconnect(done);
        });
    });
}

manualTest((instance, done) => {
    instance.sendMessage("Test Message", "Test Topic", done);
}, (err) => {
    if (err) {
        console.log("sendMessage test failed");
        throw new Error(err);
    } else {
        console.log("sendMessage test passed");
    }
});
