/** @odoo-module **/

/**
 * This module defines a service to access the sessionStorage object.
 */

import AbstractStorageService from "@web/legacy/js/core/abstract_storage_service";
import { serviceRegistry } from "@web/legacy/js/services/core";
import sessionStorage from "@web/legacy/js/core/session_storage";

var SessionStorageService = AbstractStorageService.extend({
    storage: sessionStorage,
});

serviceRegistry.add('session_storage', SessionStorageService);

export default SessionStorageService;
