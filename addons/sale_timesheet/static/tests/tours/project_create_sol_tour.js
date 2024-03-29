import { registry } from "@web/core/registry";
import "@sale_project/../tests/tours/project_create_sol_tour";
import { patch } from "@web/core/utils/patch";

patch(registry.category("web_tour.tours").get("project_create_sol_tour"), {
    steps() {
        const originalSteps = super.steps();
        const saleTimesheet = originalSteps.findIndex((step) => step.id === "project_sale_timesheet_start");
        originalSteps.splice(saleTimesheet  + 1, 1, {
            trigger: 'a.nav-link:contains(Invoicing)',
            content: 'Click on Invoicing tab to configure the invoicing of this project.',
        }, {
            trigger: ".o_field_x2many_list_row_add a",
            content: "Click on Add a line on the mapping list view.",
        }, {
            trigger: "div[name='employee_id'] input",
            content: "Add an employee to link a Sales Order Item on his timesheets into this project.",
            run: "text Thorfin",
        }, {
           content: "Create the customer in the autocomplete dropdown.",
           trigger: ".o_field_widget[name=employee_id] .o-autocomplete--dropdown-menu .o_m2o_dropdown_option_create a",
        }, {
            trigger: 'a.nav-link[name="settings"]',
            content: 'Click on Settings tab to configure this project.',
        });
        return originalSteps;
    }
});
