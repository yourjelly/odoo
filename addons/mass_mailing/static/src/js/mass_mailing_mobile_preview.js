/** @odoo-module **/

import { useService } from "@web/core/utils/hooks";
import { Dialog } from "@web/core/dialog/dialog";
const { useEffect, onMounted, onWillStart } = owl;

export class MassMailingMobilePreviewDialog extends Dialog {
    setup() {
        super.setup();
        this.rpc = useService("rpc");
        onWillStart(async () => {
            this.styleSheets = await this.rpc("/mailing/get_preview_assets");
        });
        useEffect((modalEl) => {
            if (modalEl) {
                modalEl.classList.add('oe_mobile_preview');
                const invertIcon = document.createElement("span");
                invertIcon.className = "fa fa-refresh";
                const modalHeader = modalEl.querySelector('.modal-header');
                const modalBody = modalEl.querySelector('.modal-body');
                modalHeader.querySelector('.modal-title').append(invertIcon);
                modalHeader.addEventListener('click', () => modalBody.classList.toggle('o_invert_orientation'));

                const iframe = document.createElement("iframe");
                iframe.srcdoc = this._getSourceDocument();
                modalBody.append(iframe);
            }
        }, () => [document.querySelector('.o_dialog')]);
    }

    _getSourceDocument() {
        return '<!DOCTYPE html><html>' +
                    '<head>' + this.styleSheets + '</head>' +
                    '<body>' + this.props.preview + '</body>' +
                '</html>';
    }
}

MassMailingMobilePreviewDialog.props = {
    ...Dialog.props,
    preview: { type: String },
    close: Function,
};
delete MassMailingMobilePreviewDialog.props.slots;
