"use strict";

var config, Plugin;

config = require("./manual-testing-config");
Plugin = require("../../lib/index")(config);


/**
 * Disconnects from the database sometime after the timeout.
 *
 * @param {ddqPlugin~instance} instance
 */
function handleDisconnect(instance) {
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
}


/**
 * Instantiates a plugin and uses its connection to clear all records from the
 * database.
 */
function cleanup() {
    var instance;

    instance = new Plugin();

    instance.connect((connectErr) => {
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

        handleDisconnect(instance);
    });
}


/**
 * Connects to the database and calls checkNow.
 *
 * @param {ddqPlugin~instance} instance
 */
function handleConnection(instance) {
    instance.connect((connectErr) => {
        if (connectErr) {
            console.log("There was a connection error");
            throw new Error(connectErr);
        }

        console.log("Connection was successfully made");
        instance.checkNow();
        handleDisconnect(instance);
    });
}


/**
 * Preps and runs individual tests for wrapped message methods.
 *
 * @param {Function} fn The function being tested.
 * @param {string} query The query to prep for the function.
 */
function wrappedMessageTest(fn, query) {
    var instance;

    instance = new Plugin();

    instance.on("data", (data) => {
        console.log("CheckNow data listener activated");
        // Preps for the next function call to find a record.
        instance.connection.query(query, [], (prepErr) => {
            if (prepErr) {
                console.log(`There was an error while prepping the ${fn} test`);
                throw new Error(prepErr);
            }

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
    });

    instance.on("error", (err) => {
        console.log("CheckNow error listener activated");
        throw new Error(err);
    });
    handleConnection(instance);
}


wrappedMessageTest("heartbeat", "INSERT INTO instance.config.table SET hash = data.recordId, isProcessing = true, owner = instance.owner;");
cleanup();
wrappedMessageTest("requeue", "INSERT INTO instance.config.table SET hash = data.recordId;");
cleanup();
wrappedMessageTest("remove", "INSERT INTO instance.config.table SET hash = data.recordId, requeued = false;");
cleanup();

