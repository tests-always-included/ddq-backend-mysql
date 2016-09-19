"use strict";

var crypto, EventEmitter, mysql;

// 3rd party libraries
mysql = require("mysql");

// Node modules, used for injection
crypto = require("crypto");
EventEmitter = require("events");

module.exports = require("./ddq-backend")(crypto, EventEmitter, mysql);
