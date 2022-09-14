/** @odoo-module */
import tour from 'web_tour.tour';
const today = moment();

tour.register('crm_forecast', {
    test: true,
    url: "/web",
}, [
    tour.stepUtils.showAppsMenuItem(),
    {
        trigger: ".o_app[data-menu-xmlid='crm.crm_menu_root']",
        content: "open crm app",
    }, {
        trigger: '.dropdown-toggle[data-menu-xmlid="crm.crm_menu_report"]',
        content: 'Open Reporting menu',
        run: 'click',
    }, {
        trigger: '.dropdown-item[data-menu-xmlid="crm.crm_menu_forecast"]',
        content: 'Open Forecast menu',
        run: 'click',
    }, {
        trigger: '.o_column_quick_create:contains(Add next month)',
        content: 'Wait page loading'
    }, {
        trigger: ".o-kanban-button-new",
        content: "click create",
        run: 'click',
    }, {
        trigger: ".o_field_widget[name=name] input",
        content: "complete name",
        run: "text Test Opportunity 1",
    }, {
        trigger: ".o_field_widget[name=expected_revenue] input",
        content: "complete expected revenue",
        run: "text 999999",
    }, {
        trigger: "button.o_kanban_edit",
        content: "edit lead",
    }, {
        trigger: "div[name=date_deadline] input",
        content: "complete expected closing",
        run: `text ${today.format("MM/DD/YYYY")}`,
    }, {
        trigger: "div[name=date_deadline] input",
        content: "click to make the datepicker disappear",
        run: "click"
    }, {
        trigger: "body:not(:has(div.bootstrap-datetimepicker-widget))",
        content: "wait for date_picker to disappear",
        run: function () {},
    }, {
        trigger: '.o_back_button',
        content: 'navigate back to the kanban view',
        position: "bottom",
        run: "click"
    }, {
        trigger: ".o_kanban_record .o_kanban_record_title:contains('Test Opportunity 1')",
        content: "move to the next month",
        run: function () {
            // OWL BUG: current implementation of drag_and_drop does not work with owl views (not really a bug)
            const undefined_groups = [...document.querySelectorAll(".o_column_title")].filter(el => el.innerText.includes("false")).length;
            const from = this.$anchor[0];
            const to = $(`.o_opportunity_kanban .o_kanban_group:eq(${1 + undefined_groups}) .o_kanban_record`)[0];
            from.dispatchEvent(new Event("mouseenter", { bubbles: true }));
            from.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, which: 1, button: 0, clientX: 0, clientY: 0}));
            from.dispatchEvent(new Event("mousemove", { bubbles: true }));
            to.dispatchEvent(new Event("mouseenter", { bubbles: true }));
            from.dispatchEvent(new Event("mouseup", { bubbles: true }));
        },
    }, {
        trigger: ".o_kanban_record .o_kanban_record_title:contains('Test Opportunity 1')",
        content: "edit lead",
        run: "click"
    }, {
        trigger: ".o_form_button_edit",
        content: "edit datetime",
        position: "bottom",
        run: "click"
    }, {
        trigger: ".o_field_widget[name=date_deadline] input",
        content: "complete expected closing",
        run: `text ${moment(today).add(5, 'months').startOf('month').subtract(1, 'days').format("MM/DD/YYYY")}`
    }, {
        trigger: ".o_field_widget[name=probability] input",
        content: "max out probability",
        run: "text 100"
    }, {
        trigger: '.o_back_button',
        content: 'navigate back to the kanban view',
        position: "bottom",
        run: "click"
    }, {
        trigger: '.o_kanban_add_column',
        content: "add next month",
        run: "click"
    }, {
        trigger: ".o_kanban_record:contains('Test Opportunity 1'):contains('Won')",
        content: "assert that the opportunity has the Won banner",
        run: function () {},
    }
]);
