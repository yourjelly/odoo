/** @odoo-module **/

/**
 * This module defines a service to access the localStorage object.
 */

import AbstractStorageService from "web.AbstractStorageService";
import core from "web.core";
import localStorage from "web.local_storage";

export var LocalStorageService = AbstractStorageService.extend({
    storage: localStorage,
});

core.serviceRegistry.add('local_storage', LocalStorageService);
