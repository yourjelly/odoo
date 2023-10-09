/** @odoo-module **/

import { Component, useEffect, useRef } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";

export class MassMailingMobilePreviewDialog extends Component {
    static components = {
        Dialog,
    };
    static template = "mass_mailing.MobilePreviewDialog";
    static props = {
        title: { type: String },
        preview: { type: String },
        close: Function,
    };

    appendPreview() {
        const iframe = this.iframeRef.el.contentDocument;
        const body = iframe.querySelector("body");
        body.innerHTML = this.props.preview;
    }

    setup() {
        this.iframeRef = useRef("iframeRef");
        useEffect(
            (modalEl) => {
                if (modalEl) {
                    this.modalBody = modalEl.querySelector(".modal-body");
                    modalEl.classList.add("o_mailing_mobile_preview");
                }
            },
            () => [document.querySelector(":not(.o_inactive_modal).o_dialog")]
        );
    }

    toggle() {
        this.modalBody.classList.toggle("o_invert_orientation");
    }
}

delete MassMailingMobilePreviewDialog.props.slots;
