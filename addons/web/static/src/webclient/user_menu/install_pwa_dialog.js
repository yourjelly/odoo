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

    get appClipInfo() {
        const currentApp = this.menu.getCurrentApp();
        if (currentApp) {
            return {
                path: currentApp.actionPath,
                icon: "/" + currentApp.webIcon.replace(",", "/"),
                name: currentApp.name,
                app_id: currentApp.webIcon.split(",")[0],
            };
        }
        return null;
    }

    launchInstallProcess() {
        this.installPrompt.show({
            onDone: () => this.props.close(),
        });
    }
}
