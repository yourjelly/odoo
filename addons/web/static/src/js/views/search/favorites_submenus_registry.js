odoo.define('web.favorites_submenus_registry', function (require) {
"use strict";

var SortedRegistry = require('web.SortedRegistry');

var sortFunction = function (key) {return key;};

return new SortedRegistry(null, sortFunction);

});