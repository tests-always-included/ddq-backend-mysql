/* eslint-disable no-undefined */
"use strict";

module.exports = () => {
    var connection, mock;


    /**
     * Calls callback if given.
     *
     * @param {Function} [callback]
     */
    function call(callback) {
        if (callback) {
            callback();
        }
    }

    mock = jasmine.createSpyObj("mysqlMock", [
        "createConnection"
    ]);

    connection = {
        connect: jasmine.createSpy("connect").andCallFake(call),
        beginTransaction: jasmine.createSpy("beginTransaction").andCallFake(call),
        rollback: jasmine.createSpy("rollback").andCallFake(call),
        commit: jasmine.createSpy("commit").andCallFake(call),
        end: jasmine.createSpy("end").andCallFake(() => {}),
        query: jasmine.createSpy("query")
    };
    mock.createConnection.andReturn(connection);

    return mock;
};
