/* global require */
"use strict";

const staticGettextArgumentRule = require("./static_gettext_argument");

module.exports = {
    rules: {
        "static-gettext-argument": staticGettextArgumentRule,
    },
};
