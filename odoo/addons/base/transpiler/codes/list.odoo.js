odoo.define('@tests/list', function (require) {
    'use strict';

    let __exports = {};

    Object.assign(__exports, {a, b});

    Object.assign(__exports, {aa: a, b, cc: c});

    {const {c, d} = require("@tests/Dialog");
    Object.assign(__exports, {c, d})};

    {const {e} = require("@tests/Dialog");
    Object.assign(__exports, {e})};

    {const {c,  d,  e} = require("@tests/Dialog");
    Object.assign(__exports, {cc: c, d, ee: e});}

    Object.assign(__exports, require("@tests/Dialog"));
    return __exports;
});
