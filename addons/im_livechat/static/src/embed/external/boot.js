/* @odoo-module */

import { LivechatButton } from "@im_livechat/embed/common/livechat_button";
import { makeShadow, makeRoot, loadFont } from "@im_livechat/embed/common/boot_helpers";
import { serverUrl } from "@im_livechat/embed/common/livechat_data";

import { mount, whenReady } from "@odoo/owl";

import { templates } from "@web/core/assets";
import { MainComponentsContainer } from "@web/core/main_components_container";
import { registry } from "@web/core/registry";
import { makeEnv, startServices } from "@web/env";
import { session } from "@web/session";
import { url } from "@web/core/utils/urls";

(async function boot() {
    session.origin = serverUrl;
    await whenReady();
    const mainComponentsRegistry = registry.category("main_components");
    mainComponentsRegistry.add("LivechatRoot", { Component: LivechatButton });
    const env = makeEnv();
    await startServices(env);
    odoo.isReady = true;
    const target = await makeShadow(makeRoot(document.body));
    await Promise.all([
        loadFont("FontAwesome", url("/im_livechat/font-awesome")),
        loadFont("odoo_ui_icons", url("/im_livechat/odoo_ui_icons")),
    ]);
    await mount(MainComponentsContainer, target, {
        env,
        templates,
        dev: env.debug,
    });
})();
