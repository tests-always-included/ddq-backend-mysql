"use strict";

var configValidation, crypto, EventEmitter, mysql, timers;

crypto = require("crypto");
EventEmitter = require("events");
mysql = require("mysql");
timers = require("timers");
configValidation = require("./config-validation")();
module.exports = require("./ddq-backend-mysql")(configValidation, crypto, EventEmitter, mysql, timers);

