odoo.define('@tests/list', function (require) {
    'use strict';

    let __exports = {};

    __exports = Object.assign(__exports, {a, b});

    {const {c, d} = require("@tests/Dialog");
    __exports = Object.assign(__exports, {c, d})};

    {const {e} = require("@tests/Dialog");
    __exports = Object.assign(__exports, {e})};
    return __exports;
});
