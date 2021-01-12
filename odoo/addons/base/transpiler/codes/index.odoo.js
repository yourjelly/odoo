odoo.define('@tests/index', function (require) {
    'use strict';
    let __exports = {};
    const a = __exports.a = 5;
    return __exports;
});

odoo.define('@tests', function (require) {
    'use strict';
    return require('@tests/index');
});
