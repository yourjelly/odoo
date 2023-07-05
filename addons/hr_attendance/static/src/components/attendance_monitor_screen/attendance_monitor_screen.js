/** @odoo-module **/

import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import { ListRenderer } from "@web/views/list/list_renderer";
import { useService } from "@web/core/utils/hooks";

const { onWillStart } = owl;
export class AttendanceListRenderer extends ListRenderer {
        setup() {
            super.setup(...arguments);
            this.orm = useService("orm");
            this.action = useService("action");
            this.rpc = useService("rpc");
            onWillStart(this.onWillStart);
    }

    async onWillStart() {
            this.attendance_measures = await this.rpc("/hr_attendance/monitor_screen", {});
            this.categories = this.attendance_measures["categories"]
            this.data = this.attendance_measures["data"]
        };

}
AttendanceListRenderer.template = "hr_attendance.AttendanceListRenderer";
AttendanceListRenderer.components = {
    ...AttendanceListRenderer.components,
    AttendanceListRenderer
};

export const AttendanceListView = {
    ...listView,
    Renderer: AttendanceListRenderer,
};

registry.category("views").add("attendance_list_view", AttendanceListView);
