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
        connect: jasmine.createSpy("connect").and.callFake(call),
        beginTransaction: jasmine.createSpy("beginTransaction").and.callFake(call),
        rollback: jasmine.createSpy("rollback").and.callFake(call),
        commit: jasmine.createSpy("commit").and.callFake(call),
        end: jasmine.createSpy("end").and.callFake(() => {}),
        query: jasmine.createSpy("query")
    };
    mock.createConnection.and.returnValue(connection);

    return mock;
};
