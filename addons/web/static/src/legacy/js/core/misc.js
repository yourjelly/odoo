/** @odoo-module **/

import ajax from "@web/legacy/js/core/ajax";

/**
 * Redirect to url by replacing window.location
 * If wait is true, sleep 1s and wait for the server i.e. after a restart.
 */
function redirect (url, wait) {
    var load = function() {
        var old = "" + window.location;
        var old_no_hash = old.split("#")[0];
        var url_no_hash = url.split("#")[0];
        location.assign(url);
        if (old_no_hash === url_no_hash) {
            location.reload(true);
        }
    };

    var wait_server = function() {
        ajax.rpc("/web/webclient/version_info", {}).then(load).guardedCatch(function () {
            setTimeout(wait_server, 250);
        });
    };

    if (wait) {
        setTimeout(wait_server, 1000);
    } else {
        load();
    }
}


// In Internet Explorer, document doesn't have the contains method, so we make a
// polyfill for the method in order to be compatible.
if (!document.contains) {
    document.contains = function contains (node) {
        if (!(0 in arguments)) {
            throw new TypeError('1 argument is required');
        }

        do {
            if (this === node) {
                return true;
            }
        } while (node = node && node.parentNode);

        return false;
    };
}

export default {
    redirect: redirect,
};
