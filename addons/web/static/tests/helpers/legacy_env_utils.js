/** @odoo-module */

import { registry } from "@web/core/registry";
import { uiService } from "@web/core/ui/ui_service";
import { patch } from "@web/core/utils/patch";
import { makeLegacyDialogMappingService } from "@web/legacy/utils";
import { hotkeyService } from "@web/core/hotkeys/hotkey_service";
import { bus } from "@web/legacy/js/services/core";
import makeTestEnvironment from "@web/../tests/legacy/helpers/test_env";
import { registerCleanup } from "./cleanup";
import { makeTestEnv } from "./mock_env";

const serviceRegistry = registry.category("services");

export async function makeLegacyDialogMappingTestEnv() {
    const coreBusListeners = [];
    const unpatch = patch(bus, {
        on(eventName, thisArg, callback) {
            super.on(...arguments);
            coreBusListeners.push({ eventName, callback });
        },
    });

    const legacyEnv = makeTestEnvironment({ bus: bus });
    serviceRegistry.add("ui", uiService);
    serviceRegistry.add("hotkey", hotkeyService);
    serviceRegistry.add("legacy_dialog_mapping", makeLegacyDialogMappingService(legacyEnv));

    const env = await makeTestEnv();
    legacyEnv.services.hotkey = env.services.hotkey;
    legacyEnv.services.ui = env.services.ui;

    registerCleanup(() => {
        for (const listener of coreBusListeners) {
            bus.off(listener.eventName, listener.callback);
        }
        unpatch();
    });

    return {
        legacyEnv,
        env,
    };
}
