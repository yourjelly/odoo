(async function () {
"use strict";

    // We define here a test asserting that no module failed to be loaded. The
    // module system (see boot.js) waits 10 seconds before logging that some
    // modules couldn't be loaded, when it happens. The test below is really
    // important as it will detect testing modules that can't be loaded, for
    // instance because one of their dependencies is missing. Without it, we
    // could have tests that aren't executed, without any notice.
    //
    // We have the following constraints around this test:
    //  - we want it to be always executed (obviously)
    //  - we need it to wait for the module system to complete the loading of
    //    the modules before being executed (wait for the didLogInfo promise)
    //  - we don't want it to slow down the whole suite
    //  - we can't rely on the module system to define this test, as it is
    //    partially testing it as well
    //
    // To achieve this, we ensure that this test is defined after (some of) the
    // other tests. Almost all tests need module 'web.test_utils', which is
    // asynchronous (it loads resources that are lazy-loaded outside the test
    // environment). So here, we also wait for 'web.test_utils' (without using
    // the module system) before defining our test, so that our test is defined
    // after all those requiring 'web.test_utils'. That way:
    //  - either the suite takes more than 10 seconds to execute, and once we
    //    reach our test, the promise is already resolved and it can directly
    //    check if some modules failed
    //  - or the suite takes less than 10 seconds, and our test will wait for
    //    the promise to be resolved.
    // However, in any cases, it won't slow down the test suite longer than
    // necessary.
    // const prom = new Promise(resolve => {
    //     const timeout = setTimeout(() => {
    //         // Module 'web.test_utils' must be loaded after a while, otherwise it
    //         // could mean it has been renamed, and our test will never be executed.
    //         // In this case, this will be detected by a suite that lasts longer than
    //         // 5 seconds (e.g. our main test suite).
    //         if (!odoo.__DEBUG__.services['web.test_utils']) {
    //             throw new Error('Module "web.test_utils" could not be loaded');
    //         }
    //     }, 5000);
    //     const interv = setInterval(() => {
    //         if (odoo.__DEBUG__.services['web.test_utils']) {
    //             clearInterval(interv);
    //             clearTimeout(timeout);
    //             setTimeout(resolve, 0);
    //         }
    //     }, 50);
    // });
    // await prom;

    // QUnit.module('Odoo JS Modules');

    // QUnit.test('all modules are properly loaded', async function (assert) {
    //     assert.expect(2);

    //     await odoo.__DEBUG__.didLogInfo;

    //     const modulesInfo = odoo.__DEBUG__.jsModules;
    //     assert.deepEqual(modulesInfo.missing, [],
    //         "no js module should be missing");
    //     assert.deepEqual(modulesInfo.failed, [],
    //         "no js module should have failed");
    // });

})();
