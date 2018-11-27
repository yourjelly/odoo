odoo.define('web.search_menus_registry', function (require) {
"use strict";

var Registry = require('web.Registry');

return new Registry();

});

odoo.define('web._search_menus_registry', function (require) {
"use strict";

var FavoriteMenu = require('web.FavoriteMenu');
var FilterMenu = require('web.FilterMenu');
var GroupByMenu = require('web.GroupByMenu');
var TimeRangeMenu = require('web.TimeRangeMenu');
var search_menus_registry = require('web.search_menus_registry');

search_menus_registry
    .add('filter', FilterMenu)
    .add('groupBy', GroupByMenu)
    .add('timeRange', TimeRangeMenu)
    .add('favorite', FavoriteMenu);

});