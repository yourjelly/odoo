odoo.define('@tests/list', function (require) {
    'use strict';

    let __exports = {};

    __exports = Object.assign(__exports, {a, b});

    __exports = Object.assign(__exports, {aa: a, b, cc: c});

    {const {c, d} = require("@tests/Dialog");
    __exports = Object.assign(__exports, {c, d})};

    {const {e} = require("@tests/Dialog");
    __exports = Object.assign(__exports, {e})};

    {const {c,  d,  e} = require("@tests/Dialog");
    __exports = Object.assign(__exports, {cc: c, d, ee: e});}

    __exports = Object.assign(__exports, require("@tests/Dialog"));
    return __exports;
});
