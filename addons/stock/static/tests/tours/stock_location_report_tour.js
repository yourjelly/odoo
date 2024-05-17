/** @odoo-module **/
import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add('test_location_report', {
    test: true,
    steps: () => [
        {
            trigger: 'tr.o_data_row:has(div[name="product_id"] span:contains("fake prod")) .o-checkbox input',
        },
        {
            trigger: 'button[name="action_stock_quant_relocate"]'
        },
        {
            trigger: 'input[id="dest_location_id_0"]',
            run: "text stock_location_2",
        },
        {
            trigger: ".o-autocomplete--dropdown-item > a:contains('stock_location_2')",
            auto: true,
            in_modal: false,
        },
        {
            trigger: 'button[name="action_relocate_quants"]',
        },
        {
            trigger: '.o_last_breadcrumb_item span:contains("locations")'
        }
]});