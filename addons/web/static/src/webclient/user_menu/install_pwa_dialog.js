import { Component, onWillStart } from "@odoo/owl";
import { isIOS, isBrowserSafari } from "@web/core/browser/feature_detection";
import { Dialog } from "@web/core/dialog/dialog";
import { useService } from "@web/core/utils/hooks";

export class InstallPWADialog extends Component {
    static props = {
        close: Function,
    };
    static template = "web.InstallPWADialog";
    static components = { Dialog };

    setup() {
        this.installPrompt = useService("installPrompt");
        this.menu = useService("menu");
        this.isBrowserSafari = isBrowserSafari();
        this.isIOS = isIOS();
        onWillStart(async () => {
            this.appName = await this.installPrompt.getAppName();
        });
    }

    get scopedAppInfo() {
        const currentApp = this.menu.getCurrentApp();
        if (currentApp) {
            const isAvailable = this.checkAvailability(currentApp);
            if (isAvailable) {
                return {
                    path: "scoped_app/" + currentApp.actionPath,
                    icon: "/" + currentApp.webIcon.replace(",", "/"),
                    name: currentApp.name,
                    app_id: currentApp.webIcon.split(",")[0],
                };
            }
        }
        return null;
    }

    checkAvailability(app) {
        // While the feature could work with all apps, we have decided to only
        // support the installation of the apps contained in the following list
        // The list can grow in the future, by simply adding the name of the module
        return true; //["barcode", "field-service"].includes(app.actionPath);
    }

    launchInstallProcess() {
        this.installPrompt.show({
            onDone: () => this.props.close(),
        });
    }
}
