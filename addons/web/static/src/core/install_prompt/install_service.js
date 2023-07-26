/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { _t } from "@web/core/l10n/translation";
import { isDisplayStandalone, isIOS, isMacOS } from "@web/core/browser/feature_detection";
import { registry } from "@web/core/registry";
import { InstallPrompt } from "./install_prompt";

const serviceRegistry = registry.category("services");

const installPromptService = {
    dependencies: ["dialog"],
    start(env, { dialog }) {
        let nativePrompt;

        const installationState = browser.localStorage.getItem("installationState");

        // PWA are supported on desktop Safari since version 17
        const isAvailable =
            window.BeforeInstallPromptEvent ||
            isIOS() ||
            (isMacOS() && browser.navigator.userAgent.match(/Version\/(\d+)/)[1] >= 17);

        // Installation shouldn't be already executed or declined by the user
        let isAllowedToPrompt = isAvailable && !installationState;

        const isDeclined = installationState === "declined";

        if (isAvailable && !isDeclined && !isDisplayStandalone()) {
            window.addEventListener("beforeinstallprompt", (e) => {
                if (installationState === "installed") {
                    // If this code is triggered, it means that the app has been removed.
                    // The prompt can be displayed, and the installation state is reset.
                    isAllowedToPrompt = true;
                    browser.localStorage.removeItem("installationState");
                }
                e.preventDefault();
                nativePrompt = e;
            });
        }

        async function show() {
            if (!isAllowedToPrompt) {
                return;
            }
            if (nativePrompt) {
                const res = await nativePrompt.prompt();
                if (res.outcome === "accepted") {
                    browser.localStorage.setItem("installationState", "installed");
                }
            } else if (isIOS() || isMacOS()) {
                // since those platforms don't support a native installation prompt, we
                // show a custom dialog to explain how to make an app from the website
                dialog.add(InstallPrompt, {
                    title: _t("How to get the application"),
                    onCancel: () => {},
                    onConfirm: () => {},
                    isMobileSafari: isIOS(),
                });
            }
        }

        function decline() {
            browser.localStorage.setItem("installationState", "declined");
        }

        return {
            isAllowedToPrompt,
            decline,
            show,
        };
    },
};
serviceRegistry.add("installPrompt", installPromptService);
