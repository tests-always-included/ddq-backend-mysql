"use strict";

module.exports = () => {
    var mock;

    mock = jasmine.createSpyObj("timersMock", [
        "setTimeout",
        "clearTimeout"
    ]);

    mock.setTimeout.andReturn(true);

    return mock;
};
