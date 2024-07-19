import { Component } from "@odoo/owl";
import { humanSize } from "@web/core/utils/binary";
import { Dialog } from "@web/core/dialog/dialog";
import { ShareTargetApp } from "@web/webclient/share_target/share_target_app";

export class ShareTargetDialog extends Component {
    static template = "web.ShareTargetDialog";
    static components = { Dialog, ShareTargetApp };
    static props = {
        shareTargetApps: { type: Array, element: Object },
        close: { type: Function },
        onSelectApp: { type: Function },
        title: { type: String },
        files: { type: Array, element: File },
    };

    get title() {
        const size = this.props.files
            .map((file) => file.size)
            .reduce((totalSize, size) => totalSize + size, 0);
        return `Upload ${this.props.files.length} file(s) (${humanSize(size)})`;
    }

    discard() {
        this.props.close();
    }
}
