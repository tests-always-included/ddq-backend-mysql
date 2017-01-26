"use strict";

var configValidation, crypto, debug, EventEmitter, mysql, timers;

crypto = require("crypto");
debug = require("debug")("ddq-backend-mysql");
EventEmitter = require("events");
mysql = require("mysql");
timers = require("timers");
configValidation = require("./config-validation")();
module.exports = require("./ddq-backend-mysql")(configValidation, crypto, debug, EventEmitter, mysql, timers);

