"use strict";

var config, Plugin;

config = require("./manual-testing-config");

Plugin = require("../../lib/index")(config);

/**
 * Manual test for connect, listen, pausePolling, resumePolling, and disconnect,
 * in that order.
 */
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
            throw new Error(connectErr);
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
                    console.log("There was a problem disconnecting");
                    throw new Error(err);
                } else {
                    console.log("Disconnected successfully");
                }
            });
        }, 4000);
    });
}
pollingTest();
