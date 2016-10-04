/* eslint-disable require-jsdoc */
"use strict";

var config, Plugin;

config = {
    backend: "mysql/lib/index",
    pollingRate: 1000,
    createMessageCycleLimitMs: 10,
    pollDelayMs: 500,
    heartbeatCleanupDelayMs: 1000,
    heartbeatLifetimeSeconds: 5,
    host: "localhost",
    database: "pluginSandbox",
    port: 3306,
    table: "queue",
    topics: ["SomeTopic", "blahblah", "Test Topic"],
    user: "root"
    // TODO This will break without a valid password
};

Plugin = require("../lib/index")(config);

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

// Tests polling, pausing, resuming, and the heartbeat cleanup.
function pollingTest() {
    var instance;

    instance = new Plugin();

    console.log("CurrentlyPolling should be false:", instance.currentlyPolling);
    console.log("Poller should be false:", !!instance.poller);
    console.log("Restorer should be false:", !!instance.restorer);
    console.log("Calling the listen method");
    instance.connect((connectErr) => {
        if (connectErr) {
            console.log("There was a connection error");
        }

        console.log("Connection was successfully made");
        instance.listen();
        console.log("CurrentlyPolling should now be true:", instance.currentlyPolling);
        console.log("Poller should should now be true:", !!instance.poller);
        console.log("Restorer should should now be true:", !!instance.restorer);

        setTimeout(() => {
            instance.pausePolling();
            console.log("CurrentlyPolling should now be false:", instance.currentlyPolling);
            console.log("Poller should now be false:", !!instance.poller);
            console.log("Restorer should now be false:", !!instance.restorer);
        }, 1000);

        setTimeout(() => {
            instance.resumePolling();
            console.log("CurrentlyPolling should now be true:", instance.currentlyPolling);
            console.log("Poller should should now be true:", !!instance.poller);
            console.log("Restorer should should now be true:", !!instance.restorer);
        }, 2000);

        setTimeout(() => {
            instance.pausePolling();
            console.log("CurrentlyPolling should now be false:", instance.currentlyPolling);
            console.log("Poller should now be false:", !!instance.poller);
            console.log("Restorer should now be false:", !!instance.restorer);
        }, 3000);

        setTimeout(() => {
            instance.disconnect((err) => {
                if (err) {
                    console.log("There was a problem disconnecting", err);
                } else {
                    console.log("Disconnected successfully");
                }
            });
        }, 4000);
    });
}
pollingTest();
