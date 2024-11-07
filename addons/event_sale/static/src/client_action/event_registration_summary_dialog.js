import { patch } from "@web/core/utils/patch";
import { EventRegistrationSummaryDialog } from "@event/client_action/event_registration_summary_dialog";

patch(EventRegistrationSummaryDialog.prototype, {
    setup() {
        super.setup(...arguments);
        if (this.registration.has_to_pay) {
            this.willAutoPrint = false;
            this.dialogState.isHidden = false;
        }
    },
});
