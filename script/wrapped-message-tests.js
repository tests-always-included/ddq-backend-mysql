"use strict";

var config, Plugin;

config = require("./manual-testing-config");
Plugin = require("..")(config);


/**
 * Instantiates a plugin and uses its connection to clear all records from the
 * database.
 *
 * @param {ddqPlugin~instance} instance
 * @param {Function} cb
 */
function cleanup(instance, cb) {
    instance.connection.query("DELETE FROM ??;",
        [
            instance.config.table
        ],
        (wipeErr, data) => {
            if (wipeErr) {
                console.error("There was a problem wiping the database");
                console.error(wipeErr);
                process.exitCode = 1;
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
    instance.disconnect((err) => {
        if (err) {
            console.error("There was a problem disconnecting");
            console.error(err);
            process.exitCode = 1;
            process.exit();
        } else {
            console.log("Disconnected successfully");
        }
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

        // Undefined data for heartbeat and remove is expected.
        data[fn]((err, fnData) => {
            if (err) {
                console.error(`There was an error while running ${fn}`);
                console.error(err);
            } else if (fnData && fnData.affectedRows === 0) {
                console.error(`Zero rows affected during ${fn}`);
                process.exitCode = 1;
            }

            console.log(`${fn} was successful`);
            console.log("Data:", fnData);
            cleanup(instance, handleDisconnect);
        });
    });

    instance.on("error", (err) => {
        console.error("CheckNow error listener activated");
        console.error(err);
        process.exitCode = 1;
    });
    instance.connect((err) => {
        if (err) {
            console.error(err);
            process.exitCode = 1;
        }

        instance.connection.query(query,
            [
                instance.config.table,
                instance.owner
            ],
            (checkNowPrepErr, checkNowPrepData) => {
                if (checkNowPrepErr) {
                    console.error("There was an error prepping checkNow", checkNowPrepErr);
                    console.error(checkNowPrepErr);
                    process.exitCode = 1;
                }

                console.log("CheckNow prep was successful", checkNowPrepData);
                instance.checkNow();
            }
        );
    });
}


wrappedMessageTest("heartbeat", "INSERT INTO ?? (hash, isProcessing, owner, messageBase64) VALUES('123', true, ?, '456');");
setTimeout(() => {
    wrappedMessageTest("requeue", "INSERT INTO ?? (hash, messageBase64) VALUES ('345', '789');");
}, 10000);
setTimeout(() => {
    wrappedMessageTest("remove", "INSERT INTO ?? (hash, requeued, messageBase64) VALUES('456', false, '789');");
}, 20000);
