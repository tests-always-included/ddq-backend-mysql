"use strict";

var configValidation, crypto, EventEmitter, mysql, timers;

crypto = require("crypto");
EventEmitter = require("events");
mysql = require("mysql");
timers = require("timers");
configValidation = require("./config-validation")();
module.exports = (config) => {
    return require("./ddq-backend-mysql")(config, configValidation, crypto, EventEmitter, mysql, timers);
};

