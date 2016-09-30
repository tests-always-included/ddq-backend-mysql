"use strict";

module.exports = () => {
    var mock;

    mock = jasmine.createSpyObj("timersMock", [
        "setTimeout",
        "clearTimeout"
    ]);

    return mock;
};
