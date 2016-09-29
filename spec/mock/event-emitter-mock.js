"use strict";

module.exports = () => {
    class EventEmitterMock {
        emit(eventTag, eventContent) {
            return eventContent;
        }
    }

    return EventEmitterMock;
};
