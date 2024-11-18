import { registry } from "@web/core/registry";
import { user } from "@web/core/user";
import { session } from "@web/session";

if (user.isInternalUser === undefined) {
    console.warn(
        "isInternalUser information is required for this handler to work. It must be available in the page."
    );
}

/**
 * We don't want to show tracebacks to non internal users. This handler swallows
 * all errors if we're not an internal user (except in debug or test mode).
 */
export function swallowAllErrors(/*env, error, originalError*/) {
    if (!user.isInternalUser && !odoo.debug && !session.test_mode) {
        return true;
    }
}

registry.category("error_handlers").add("swallowAllErrors", swallowAllErrors, { sequence: 1 });
