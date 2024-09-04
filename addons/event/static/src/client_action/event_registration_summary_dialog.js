/** @odoo-module **/

import { Component, onMounted, useState } from "@odoo/owl";
import { isBarcodeScannerSupported } from "@web/core/barcode/barcode_video_scanner";
import { Dialog } from "@web/core/dialog/dialog";
import { useService } from "@web/core/utils/hooks";

export class EventRegistrationSummaryDialog extends Component {
    static template = "event.EventRegistrationSummaryDialog";
    static components = { Dialog };
    static props = {
        close: Function,
        doNextScan: { type: Function, optional: true },
        playSound: { type: Function, optional: true },
        registration: { type: Object, optional: true },
        model: { type: Object, optional: true },
    };

    setup() {
        this.actionService = useService("action");
        this.isBarcodeScannerSupported = isBarcodeScannerSupported();
        this.orm = useService("orm");
        this.notification = useService("notification");

        this.registrationStatus = useState({ value: this.registration.status });

        onMounted(() => {
            if (this.props.playSound) {
                if (this.props.registration.status === 'already_registered' || this.props.registration.status === 'need_manual_confirmation') {
                    this.props?.playSound("notify");
                } else if (this.props.registration.status === 'not_ongoing_event' || this.props.registration.status === 'canceled_registration') {
                    this.props?.playSound("error");
                }
            }
        });
    }

    get registration() {
        return this.props.registration;
    }

    get needManualConfirmation() {
        return this.registration.status === "need_manual_confirmation";
    }

    async onRegistrationConfirm() {
        await this.orm.call("event.registration", "action_set_done", [this.registration.id]);
        this.registrationStatus.value = "confirmed_registration";
        this.props.close();
        if (this.props.model) {
            this.props.model.action.loadState();
        }
        if (this.props.doNextScan) {
            this.onScanNext();
        }
    }

    async undoRegistration() {
        await this.orm.call("event.registration", "action_confirm", [this.registration.id]);
        this.props.close();
        this.props.model.action.loadState();
    }

    onRegistrationPrintPdf() {
        this.actionService.doAction({
            type: "ir.actions.report",
            report_type: "qweb-pdf",
            report_name: `event.event_registration_report_template_badge/${this.registration.id}`,
        });
    }

    async onRegistrationView() {
        await this.actionService.doAction({
            type: "ir.actions.act_window",
            res_model: "event.registration",
            res_id: this.registration.id,
            views: [[false, "form"]],
            target: "current",
        });
        this.props.close();
    }

    async onScanNext() {
        this.props.close();
        this.props.doNextScan();
    }
}
