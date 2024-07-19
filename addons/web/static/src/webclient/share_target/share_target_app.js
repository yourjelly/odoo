import { Component } from "@odoo/owl";

export class ShareTargetApp extends Component {
    static template = "web.ShareTargetApp";

    static props = {
        files: { type: Array, element: File },
        shareTargetApp: { type: Object },
        onSelectApp: { type: Function },
    };

    get app() {
        return this.props.shareTargetApp;
    }

    get icon() {
        if (this.app) {
            if (this.app.webIconData.includes(",")) {
                return this.app.webIconData;
            }
            if (this.app.webIconDataMimetype) {
                return `data:${this.app.webIconDataMimetype};base64,${this.app.webIconData}`;
            }
            if (this.app.webIcon) {
                return `/${this.app.webIcon.replace(",", "/")}`;
            }
        }
        return "/web/static/img/odoo-icon.svg";
    }

    get name() {
        return this.app.name;
    }

    get files() {
        return this.props.files;
    }

    async process() {
        // open the app
        this.props.onSelectApp(this.app);
    }
}
