odoo.define('web.LocalStorageService', function (require) {
'use strict';

/**
 * This module defines a service to access the localStorage object.
 */

var AbstractStorageService = require('web.AbstractStorageService');
var localStorage = require('web.local_storage');

var LocalStorageService = AbstractStorageService.extend({
    storage: localStorage,
});

return LocalStorageService;

});
