import { registry } from "@web/core/registry";
import { browser } from "@web/core/browser/browser";

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
    dependencies: ["menu"],
    start(env, { menu }) {
        let sharedData = null;
        if (
            browser.navigator.serviceWorker &&
            new URL(browser.location).searchParams.get("share_target") === "trigger"
        ) {
            const app = menu.getApps().find((app) => "expenses" === app.actionPath);
            if (app) {
                const clientReadyListener = async () => {
                    sharedData = await getShareTargetDataFromServiceWorker();
                    if (sharedData.externalMediaFiles.length) {
                        await menu.selectMenu(app);
                    }
                    env.bus.removeEventListener("WEB_CLIENT_READY", clientReadyListener);
                };
                env.bus.addEventListener("WEB_CLIENT_READY", clientReadyListener);
            }
        }
        return {
            /**
             * Return true if we receive share target files from service worker
             * @return {boolean}
             */
            hasSharedFiles: () => !!sharedData?.externalMediaFiles?.length,
            /**
             * Return the shared files retrieve for upload
             * @return {null|File[]}
             */
            getSharedFilesToUpload: () => {
                const files = sharedData?.externalMediaFiles;
                sharedData = null;
                return files;
            },
        };
    },
};

registry.category("services").add("shareTarget", shareTargetService);
