"use strict";

var config, Plugin;

config = require("./manualTestConfig");
Plugin = require("../../lib/index")(config);

/**
 * Instantiates a plugin and uses its connection to clear all records from the
 * database.
 */
function cleanup() {
    var instance;

    instance = new Plugin();

    instance.connection((connectErr) => {
        if (connectErr) {
            console.log("There was a problem connection during cleanup");
            throw new Error(connectErr);
        } else {
            instance.connection.query("DELETE FROM ??;",
            [config.table],
            (wipeErr, data) => {
                if (wipeErr) {
                    console.log("There was a problem wiping the database");
                    throw new Error(wipeErr);
                }

                console.log("Cleanup was successful");
                console.log(data);
            });
        }
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


/**
 * Wrapper for testing the individual methods that are received from a DDQ
 * Plugin wrapped message.
 *
 * @param {Function} fn
 */
function wrappedMessageTest(fn) {
    var instance;

    instance = new Plugin();

    instance.on("data", (data) => {
        console.log("CheckNow data listener activated");
        console.log("data", data);
        data[fn]((err, fnData) => {
            if (err) {
                console.log("There was an error");
                throw new Error(err);
            } else {
                console.log("Function was successful");
                console.log("Data:", fnData);
            }
        });
    });

    instance.on("error", (err) => {
        console.log("CheckNow error listener activated");
        throw new Error(err);
    });
    instance.connect((connectErr) => {
        if (connectErr) {
            console.log("There was a connection error");
            throw new Error(connectErr);
        }

        console.log("Connection was successfully made");
        instance.checkNow();

        setTimeout(() => {
            instance.disconnect((err) => {
                if (err) {
                    console.log("There was a problem disconnecting");
                    throw new Error(err);
                } else {
                    console.log("Disconnected successfully");
                }
            });
        }, 2000);
    });
}


/**
 * Creates a record that has a hash, an isProcessing value of true, and an owner
 * value that is the same as that set to the config and adds that record to the
 * database. In short, it is a match for the conditions that heartbeat searches
 * for.
 */
function heartbeatPrep() {
    var instance;

    instance = new Plugin();
}

/**
 * Creates a record and adds it to the database.
 */
function requeuePrep() {
    var instance;

    instance = new Plugin();
}

/**
 * Creates a record that has a hash and a requeued value set to false and adds
 * it to the database.
 */
function removePrep() {
    var instance;

    instance = new Plugin();
}


heartbeatPrep();
wrappedMessageTest("heartbeat");
cleanup();
requeuePrep();
wrappedMessageTest("requeue");
cleanup();
removePrep();
wrappedMessageTest("remove");
cleanup();

