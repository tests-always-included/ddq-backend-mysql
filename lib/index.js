"use strict";

var crypto, EventEmitter, mysql, timers;

crypto = require("crypto");
EventEmitter = require("events");
mysql = require("mysql");
timers = require("timers");

module.exports = require("./ddq-backend")(crypto, EventEmitter, mysql, timers);
