import { KanbanController } from "@web/views/kanban/kanban_controller";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { registry } from "@web/core/registry";
import { EventRegistrationSummaryDialog } from "../client_action/event_registration_summary_dialog";
import { useService } from "@web/core/utils/hooks";

export default class EventRegistrationKanbanController extends KanbanController {

    setup() {
        super.setup()
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

registry.category("views").add("registration_dialog_kanban", {
    ...kanbanView,
    Controller: EventRegistrationKanbanController,
});
