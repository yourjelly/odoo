/** @odoo-module **/

import { pivotView } from "@web/views/pivot/pivot_view";
import { hrTimesheetPivotModel } from "./timesheet_pivot_model";
import { registry } from "@web/core/registry";

const hrTimesheetPivotView = {
    ...pivotView,
    Model: hrTimesheetPivotModel,
};

registry.category("views").add("hr_timesheet_pivot", hrTimesheetPivotView);
