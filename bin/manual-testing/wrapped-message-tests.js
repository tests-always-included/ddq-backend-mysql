"use strict";

var config, Plugin;

config = require("./manual-testing-config");
Plugin = require("../../lib/index")(config);


/**
 * Instantiates a plugin and uses its connection to clear all records from the
 * database.
 *
 * @param {ddqPlugin~instance} instance
 * @param {Function} cb
 */
function cleanup(instance, cb) {
    instance.connection.query("DELETE FROM ??;",
        [instance.config.table],
        (wipeErr, data) => {
            if (wipeErr) {
                console.log("There was a problem wiping the database");
                throw new Error(wipeErr);
            }

            console.log("Cleanup was successful");
            // This should be 0 in the case of remove
            console.log("Affected Rows", data.affectedRows);
            cb(instance);
        }
    );
}


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
        // Undefined data for heartbeat and remove is expected.
        data[fn]((err, fnData) => {
            if (err) {
                console.log(`There was an error while running ${fn}`);
                throw new Error(err);
            } else if (fnData && fnData.affectedRows === 0) {
                throw new Error(`Zero rows affected during ${fn}`);
            }

            console.log(`${fn} was successful`);
            console.log("Data:", fnData);
        });
        setTimeout(() => {
            cleanup(instance, handleDisconnect);
        }, 3000);
    });

    instance.on("error", (err) => {
        console.log("CheckNow error listener activated");
        throw new Error(err);
    });
    instance.connect(() => {});
    setTimeout(() => {
        instance.connection.query(query,
            [instance.config.table, instance.owner],
            (checkNowPrepErr, checkNowPrepData) => {
                if (checkNowPrepErr) {
                    console.log("There was an error prepping checkNow",
                        checkNowPrepErr);
                    throw new Error(checkNowPrepErr);
                }

                console.log("CheckNow prep was successful", checkNowPrepData);
            }
        );
    }, 2000);
    setTimeout(() => {
        instance.checkNow();
    }, 4000);
}


wrappedMessageTest("heartbeat", "INSERT INTO ?? (hash, isProcessing, owner, messageBase64) VALUES('123', true, ?, '456');");
setTimeout(() => {
    wrappedMessageTest("requeue", "INSERT INTO ?? (hash, messageBase64) VALUES ('345', '789');");
}, 10000);
setTimeout(() => {
    wrappedMessageTest("remove", "INSERT INTO ?? (hash, requeued, messageBase64) VALUES('456', false, '789');");
}, 20000);
