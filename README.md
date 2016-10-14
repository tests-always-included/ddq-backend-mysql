DeDuplicated Queue MySQL Plugin
===============================

[![Build Status][travis-image]][Travis CI]
[![Dependencies][dependencies-image]][Dependencies]
[![Dev Dependencies][devdependencies-image]][Dev Dependencies]
[![codecov.io][codecov-image]][Code Coverage]


About
-----

A MySQL plugin for the DeDuplicated Queue (DDQ) module. The DDQ module and a whole host of documentation (including installation instructions) can be found here: https://github.com/tests-always-included/ddq


Configuration
-------------

In order to get up and running, you'll need to fill out several config options. DDQ instantiates the DDQ MySQL Plugin and passes in a config file, so do not create another config file for the DDQ MySQL Plugin. Simply add these fields to your DDQ config and they will be utilized by the Plugin.

Here's an example of a DDQ config that would work with this plugin:


    {
        backend: "MySQL"
        backendConfig: {
            database: "exampleDatabase",
            heartbeatCleanupDelayMs: 3000
            heartbeatLifetimeSeconds: 3,
            host: "localhost",
            password: "examplePassword",
            pollingDelayMs: 5000,
            port: 3306,
            table: 'exampleTable',
            topics: [
                "topic1",
                "topic2",
                null
            ],
            user: "exampleUser",
        },
        heartbeatDelayMs: 1000,
        createMessageCycleLimit: 10
    }


### General

* `createMessageCycleLimit` - The max number of times the Plugin will attempt to create a record in the database after initially failing to do so.
* `heartbeatCleanupDelayMs` - The minimum delay between two invocations of the `heartbeatCleanup` method.
* `heartbeatLifetimeSeconds` - A filtering option for the `heartbeatCleanup` method.
* `pollingDelayMs` - The minimum delay between two invocations of the `poll` method.
* `topics` - The category or categories that a given instance of the Plugin is concerned with. This field is optional, and will be `null` if left empty.


### MySQL Specific

* `database` - Name of the database to use for this connection.
* `host` - The hostname of the database you are connecting to. Default: `localhost`
* `password` - The password of that MySQL user.
* `port` - The port number to connect to. Default: `3306`
* `table` - The table the MySQL commands will act on.
* `user` - The MySQL user to authenticate as.

This module doesn't support every config option that MySQL offers, but only those most pertinent to getting things working. The full suite of options can be found here: https://github.com/mysqljs/mysql#connection-options. If you'd like more options in this plugin supported, check out this contributing doc: https://github.com/tests-always-included/ddq-backend-mock/blob/master/CONTRIBUTING.md


[Code Coverage]: https://codecov.io/github/tests-always-included/ddq-backend-mysql?branch=master
[codecov-image]: https://codecov.io/github/tests-always-included/ddq-backend-mysql/coverage.svg?branch=master
[Dev Dependencies]: https://david-dm.org/tests-always-included/ddq-backend-mysql#info=devDependencies
[devdependencies-image]: https://david-dm.org/tests-always-included/ddq-backend-mysql/dev-status.png
[Dependencies]: https://david-dm.org/tests-always-included/ddq-backend-mysql
[dependencies-image]: https://david-dm.org/tests-always-included/ddq-backend-mysql.png
[travis-image]: https://secure.travis-ci.org/tests-always-included/ddq-backend-mysql.png
[Travis CI]: http://travis-ci.org/tests-always-included/ddq-backend-mysql

