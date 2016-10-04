/* eslint-disable require-jsdoc */
"use strict";

var config, Plugin;

config = require("./manualTestConfig");
Plugin = require("../../lib/index")(config);


function cleanup() {
    var instance;

    instance = new Plugin();

    instance.connection((connectionErr) => {
        if (connectionErr) {
            throw new Error("There was a problem connecting during cleanup", connectionErr);
        } else {
            instance.connection.query("DELETE FROM ??;",
            [config.table],
            (wipeErr, data) => {
                if (wipeErr) {
                    throw new Error("There was a problem wiping the database",
                        wipeErr);
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


function wrappedMessageTest(fn) {
    var instance;

    instance = new Plugin();

    instance.on("data", (data) => {
        console.log("CheckNow data listener activated");
        console.log("data", data);
        data[fn]((err, fnData) => {
            if (err) {
                console.log("There was an error");
                console.log(err);
            } else {
                console.log("Function was successful");
                console.log("Data:", fnData);
            }
        });
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

function heartbeatPrep() {
    var instance;

    instance = new Plugin();
}


function requeuePrep() {
    var instance;

    instance = new Plugin();
}


function removePrep() {
    var instance;

    instance = new Plugin();
}


// TODO Add record with hash equal to a specific ID, isProcessing is true, and
// the owner is the same as the owner defined in the config
heartbeatPrep();
wrappedMessageTest("heartbeat");
cleanup();
requeuePrep();
// TODO Add record with hash equal to a specific ID
wrappedMessageTest("requeue");
cleanup();
removePrep();
// TODO Add record with specific hash, requeued is false
wrappedMessageTest("remove");
cleanup();

