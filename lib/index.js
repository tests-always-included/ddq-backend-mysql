"use strict";

var mysql;

// Node modules, used for injection
mysql = require("node-mysql");

module.exports = require("./ddq-backend")(mysql);
