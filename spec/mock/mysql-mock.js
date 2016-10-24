/* eslint-disable no-undefined */
"use strict";

module.exports = () => {
    var connection, mock;

    mock = jasmine.createSpyObj("mysqlMock", [
        "createConnection"
    ]);

    connection = {
        connect: jasmine.createSpy("connect").andCallFake((callback) => {
            callback();
        }),
        end: jasmine.createSpy("end").andCallFake(() => {}),
        query: jasmine.createSpy("query")
    };
    mock.createConnection.andReturn(connection);

    return mock;
};
