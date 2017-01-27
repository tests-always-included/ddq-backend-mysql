"use strict";

var BackendTester, exit, tester;

exit = process.exit;
BackendTester = require("ddq-backend-tests")();
tester = new BackendTester();
tester.runAllTests((testErr) => {
    if (testErr) {
        console.error("Error occurred running DDQ backend functional tests.");

        throw testErr;
    }

    console.log("Successfully ran backend plugin functional tests");
    exit(0);
});
