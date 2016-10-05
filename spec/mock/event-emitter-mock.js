"use strict";

module.exports = () => {
    /**
     * Class for mock EventEmitter that the DDQ Plugin will inherit from in
     * tests.
     */
    class EventEmitterMock {
        /**
         * Mock of the emit method. Allows for easy spying and testing.
         *
         * @param {string} eventTag
         * @param {Object} eventContent
         * @return {Object}
         */
        emit(eventTag, eventContent) {
            return eventContent;
        }
    }

    return EventEmitterMock;
};
