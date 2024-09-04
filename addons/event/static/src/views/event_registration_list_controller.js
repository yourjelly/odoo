import { ListController } from "@web/views/list/list_controller";
import { listView } from "@web/views/list/list_view";
import { registry } from "@web/core/registry";
import { EventRegistrationSummaryDialog } from "../client_action/event_registration_summary_dialog";
import { useService } from "@web/core/utils/hooks";

export default class EventRegistrationListController extends ListController {

    setup() {
        super.setup();
        this.dialog = useService("dialog");
        this.orm = useService("orm");
    }

    async openRecord(record, mode) {
        const barcode = record.data.barcode
        const eventId = record.data.event_id[0]

        const result = await this.orm.call("event.registration", "register_attendee", [], {
            barcode: barcode,
            event_id: eventId,
        });

        this.dialog.add(
            EventRegistrationSummaryDialog,
            {
                registration: result,
                model: this.model
            }
        )
    }
}

registry.category("views").add("registration_dialog_list", {
    ...listView,
    Controller: EventRegistrationListController,
});
