"use strict";

module.exports = () => {
    var mock;

    mock = jasmine.createSpyObj("mysqlMock", [
        "createConnection"
    ]);

    mock.createConnection.andReturn({
        connect: (callback) => {
            callback();
        },
        end: (callback) => {
            callback();
        },
        query: (sqlCommand, escapedValues, callback) => {
            callback();
        }
    });

    return mock;
};
