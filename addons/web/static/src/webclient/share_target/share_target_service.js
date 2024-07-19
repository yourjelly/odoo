import { registry } from "@web/core/registry";
import { browser } from "@web/core/browser/browser";
import { ShareTargetDialog } from "@web/webclient/share_target/share_target_dialog";
import { _t } from "@web/core/l10n/translation";

/**
 * @return {Promise<{
 *     title:string,
 *     text:string,
 *     url:string,
 *     externalMediaFiles:File[]
 * }>}
 */
const getShareTargetDataFromServiceWorker = () => {
    return new Promise((resolve) => {
        const onmessage = (event) => {
            if (event.data.action === "odoo_share_target_ack") {
                resolve(event.data.shared);
                browser.navigator.serviceWorker.removeEventListener("message", onmessage);
            }
        };
        browser.navigator.serviceWorker.addEventListener("message", onmessage);
        browser.navigator.serviceWorker.controller.postMessage("odoo_share_target");
    });
};

export const shareTargetService = {
    dependencies: ["dialog", "menu"],
    start(env, { dialog, menu }) {
        let sharedData = null;
        let selectedApp = null;
        if (
            browser.navigator.serviceWorker &&
            new URL(browser.location).searchParams.get("share_target") === "trigger"
        ) {
            const clientReadyListener = async () => {
                const shareTargetApps = registry.category("share_target").getAll();
                if (shareTargetApps.length) {
                    sharedData = await getShareTargetDataFromServiceWorker();
                    if (sharedData.externalMediaFiles.length) {
                        const apps = menu
                            .getApps()
                            .filter((app) => shareTargetApps.includes(app.actionPath));
                        if (apps.length) {
                            const onSelectApp = async (app) => {
                                selectedApp = app.actionPath;
                                await menu.selectMenu(app);
                            };
                            if (apps.length === 1) {
                                await onSelectApp(apps[0]);
                            } else {
                                dialog.add(ShareTargetDialog, {
                                    shareTargetApps: apps,
                                    title: _t(
                                        "Select what you want to create from the %s record(s)",
                                        sharedData.externalMediaFiles.length
                                    ),
                                    files: sharedData.externalMediaFiles,
                                    onSelectApp,
                                });
                            }
                        }
                    }
                }
                env.bus.removeEventListener("WEB_CLIENT_READY", clientReadyListener);
            };
            env.bus.addEventListener("WEB_CLIENT_READY", clientReadyListener);
        }
        return {
            /**
             * Return true if we receive share target files from service worker
             * @return {boolean}
             */
            hasSharedFiles: () => !!sharedData?.externalMediaFiles?.length,
            /**
             * Return the selected xmlid as upload target app
             * @return {null|String}
             */
            selectedApp: () => selectedApp,
            /**
             * Return the shared files retrieve for upload
             * @return {null|File[]}
             */
            getSharedFilesToUpload: () => sharedData?.externalMediaFiles,
            /**
             * clean up share target data
             */
            cleanup() {
                sharedData = null;
                selectedApp = null;
            },
        };
    },
};

registry.category("services").add("share_target", shareTargetService);
