/* eslint-disable require-jsdoc */
"use strict";

var config, Plugin;

config = require("./manualTestConfig");

Plugin = require("../../lib/index")(config);

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

// sendMessage
manualTest((instance, done) => {
    instance.sendMessage("Test Message", "Test Topic", (err) => {
        console.log("Test Callback");
        done(err);
    });
}, (err) => {
    if (err) {
        console.log("sendMessage test failed");
        console.log(err);
    } else {
        console.log("sendMessage test passed");
    }
});

// Tests checkNow and all of the methods that are within wrapped message.
function checkNowTest() {
    var instance;

    instance = new Plugin();

    instance.on("data", (data) => {
        console.log("CheckNow data listener activated");
        console.log("data", data);
        data.requeue((err, requeueData) => {
            if (err) {
                console.log("There was an error while running requeue");
                console.log(err);
            } else {
                console.log("Requeue was successful");
                console.log("Requeue Data", requeueData);
            }
        });
        data.heartbeat((err, heartbeatData) => {
            if (err) {
                console.log("There was an error while running heartbeat");
                console.log(err);
            } else {
                console.log("Heartbeat was successful");
                console.log("Heartbeat Data", heartbeatData);
            }
        });
        data.remove();
    });

    instance.on("error", (err) => {
        console.log("CheckNow error listener activated");
        console.log(err);
    });

    instance.connect((connectErr) => {
        if (connectErr) {
            console.log("There was a connection error");
        }

        console.log("Connection was successfully made");
        instance.checkNow();

        setTimeout(() => {
            instance.disconnect((err) => {
                if (err) {
                    console.log("There was a problem disconnecting", err);
                } else {
                    console.log("Disconnected successfully");
                }
            });
        }, 2000);
    });
}
checkNowTest();
