odoo.define('web.test_utils_action_manager', function (require) {
"use strict";

const testUtilsAsync = require('web.test_utils_async');

function doAction(action, options) {
    const env = owl.Component.env;
    env.bus.trigger('do-action', {action, options});
    return testUtilsAsync.nextTick();
}

return {
    doAction: doAction,
}

});