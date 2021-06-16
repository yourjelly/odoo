/** @odoo-module */

import { registry } from "@web/core/registry";

const { Component } = owl;
const { css, xml } = owl.tags;

const SELECTION_VALUES = [
    ["todo", "To do"],
    ["ongoing", "On going"],
    ["done", "Done"],
];

class FormView extends Component {
    setup() {
        this.sections = [
            {
                field: "ace",
                propsList: [{ value: false }],
            },
            {
                field: "attachment_image",
                propsList: [{ value: false }],
            },
            {
                field: "badge",
                propsList: [
                    { value: false, meta: { type: "char" } },
                    { value: "Char", meta: { type: "char" } },
                    { value: [0, "Mitchell Admin"], meta: { type: "many2one" } },
                    { value: "done", meta: { type: "selection", selection: SELECTION_VALUES } },
                ],
            },
            {
                field: "binary",
                propsList: [{ value: false }],
            },
            {
                field: "boolean",
                propsList: [
                    { value: false, isEditing: false },
                    { value: true, isEditing: false },
                    { value: false, isEditing: true },
                    { value: true, isEditing: true },
                ],
            },
            {
                field: "boolean_favorite",
                propsList: [
                    { value: false, attrs: { nolabel: false } },
                    { value: false, attrs: { nolabel: true } },
                    { value: true, attrs: { nolabel: false } },
                    { value: true, attrs: { nolabel: true } },
                ],
            },
            {
                field: "boolean_toggle",
                propsList: [{ value: false }],
            },
            {
                field: "char",
                propsList: [
                    { value: false, isEditing: false },
                    { value: "", isEditing: false },
                    { value: "Hello, world", isEditing: false },
                    { value: "Hello, world", isEditing: false, attrs: { password: true } },
                    { value: "", isEditing: true },
                    { value: "", isEditing: true, attrs: { placeholder: "Some text" } },
                    { value: "Hello, world", isEditing: true, attrs: { password: true } },
                ],
            },
            {
                field: "color",
                propsList: [{ value: false }],
            },
            {
                field: "color_picker",
                propsList: [{ value: false }],
            },
            {
                field: "copy_clipboard_char",
                propsList: [{ value: false }, { value: "Hello" }, { value: "World!" }],
            },
            {
                field: "copy_clipboard_text",
                propsList: [{ value: false }],
            },
            {
                field: "copy_clipboard_url",
                propsList: [{ value: false }],
            },
            {
                field: "dashboard_graph",
                propsList: [{ value: false }],
            },
            {
                field: "date",
                propsList: [{ value: false }],
            },
            {
                field: "daterange",
                propsList: [{ value: false }],
            },
            {
                field: "datetime",
                propsList: [{ value: false }],
            },
            {
                field: "email",
                propsList: [
                    { value: false, isEditing: false },
                    { value: "me@mail.com", isEditing: false },
                    { value: false, isEditing: true },
                    { value: false, isEditing: true, attrs: { placeholder: "email" } },
                    { value: "me@mail.com", isEditing: true },
                ],
            },
            {
                field: "float",
                propsList: [
                    { value: false, isEditing: false },
                    { value: 0.0, isEditing: false },
                    { value: -4, isEditing: false },
                    { value: 10.54321, isEditing: false },
                    {
                        value: 10.54321,
                        isEditing: false,
                        attrs: { options: { digits: "[16, 5]" } },
                    },
                    { value: false, isEditing: true, attrs: { placeholder: "placeholder" } },
                    { value: 0.0, isEditing: true },
                    { value: -4, isEditing: true },
                    { value: 10.54321, isEditing: true },
                    { value: 10.54321, isEditing: true, attrs: { options: { digits: "[16, 5]" } } },
                ],
            },
            {
                field: "float_factor",
                propsList: [
                    { value: false, isEditing: false, options: { factor: 0.1 } },
                    { value: 0.0, isEditing: false, options: { factor: 0.1 } },
                    { value: -4, isEditing: false, options: { factor: 0.1 } },
                    { value: 10.54321, isEditing: false, options: { factor: 0.1 } },
                    {
                        value: 10.54321,
                        isEditing: false,
                        attrs: { options: { digits: "[16, 5]" } },
                        options: { factor: 0.1 },
                    },
                    {
                        value: false,
                        isEditing: true,
                        attrs: { placeholder: "placeholder" },
                        options: { factor: 0.1 },
                    },
                    { value: 0.0, isEditing: true, options: { factor: 0.1 } },
                    { value: -4, isEditing: true, options: { factor: 0.1 } },
                    { value: 10.54321, isEditing: true, options: { factor: 0.1 } },
                    {
                        value: 10.54321,
                        isEditing: true,
                        attrs: { options: { digits: "[16, 5]" } },
                        options: { factor: 0.1 },
                    },
                ],
            },
            {
                field: "float_time",
                propsList: [
                    { value: false, isEditing: false },
                    { value: 0.0, isEditing: false },
                    { value: -4, isEditing: false },
                    { value: 10.25, isEditing: false },
                    {
                        value: false,
                        isEditing: true,
                        attrs: { placeholder: "placeholder" },
                    },
                    { value: 0.0, isEditing: true },
                    { value: -4, isEditing: true },
                    { value: 10.25, isEditing: true },
                ],
            },
            {
                field: "float_toggle",
                propsList: [{ value: false }],
            },
            {
                field: "font",
                propsList: [{ value: false }],
            },
            {
                field: "image",
                propsList: [{ value: false }],
            },
            {
                field: "image_url",
                propsList: [{ value: false }],
            },
            {
                field: "integer",
                propsList: [
                    { value: false, isEditing: false },
                    { value: 0, isEditing: false },
                    { value: -1, isEditing: false },
                    { value: 1, isEditing: false },
                    { value: false, isEditing: true, attrs: { placeholder: "placeholder" } },
                    { value: 0, isEditing: true },
                    { value: -1, isEditing: true },
                    { value: 1, isEditing: true },
                ],
            },
            {
                field: "label_selection",
                propsList: [{ value: false }],
            },
            {
                field: "link_button",
                propsList: [{ value: false }, { value: "https://www.google.com" }],
            },
            {
                field: "many2many",
                propsList: [{ value: false }],
            },
            {
                field: "many2many_binary",
                propsList: [{ value: false }],
            },
            {
                field: "many2many_checkboxes",
                propsList: [{ value: false }],
            },
            {
                field: "many2many_tags",
                propsList: [{ value: false }],
            },
            {
                field: "many2many_tags_avatar",
                propsList: [{ value: false }],
            },
            {
                field: "many2one",
                propsList: [{ value: false }],
            },
            {
                field: "many2one_avatar",
                propsList: [{ value: false }],
            },
            {
                field: "many2one_barcode",
                propsList: [{ value: false }],
            },
            {
                field: "many2one_reference",
                propsList: [{ value: false }],
            },
            {
                field: "monetary",
                propsList: [
                    { value: false, isEditing: false },
                    { value: 0, isEditing: false },
                    { value: 10.0, isEditing: false },
                    { value: 0.42, isEditing: false },
                    { value: false, isEditing: true },
                    { value: 0, isEditing: true },
                    { value: 10.0, isEditing: true },
                    { value: 0.42, isEditing: true },
                ],
            },
            {
                field: "one2many",
                propsList: [{ value: false }],
            },
            {
                field: "pdf_viewer",
                propsList: [{ value: false }],
            },
            {
                field: "percentpie",
                propsList: [{ value: false }],
            },
            {
                field: "percentage",
                propsList: [{ value: false }],
            },
            {
                field: "phone",
                propsList: [
                    { value: false, isEditing: false },
                    { value: "0123456789", isEditing: false },
                    { value: false, isEditing: true },
                    { value: false, isEditing: true, attrs: { placeholder: "phone" } },
                    { value: "0123456789", isEditing: true },
                ],
            },
            {
                field: "priority",
                propsList: [
                    {
                        value: "todo",
                        meta: { selection: SELECTION_VALUES },
                    },
                    {
                        value: "ongoing",
                        meta: { selection: SELECTION_VALUES },
                    },
                    {
                        value: "done",
                        meta: { selection: SELECTION_VALUES },
                    },
                ],
            },
            {
                field: "progressbar",
                propsList: [{ value: false }],
            },
            {
                field: "radio",
                propsList: [{ value: false }],
            },
            {
                field: "reference",
                propsList: [{ value: false }],
            },
            {
                field: "remaining_days",
                propsList: [
                    { value: false, meta: { type: "date" } },
                    { value: luxon.DateTime.utc().toFormat("yyyy-MM-dd"), meta: { type: "date" } },
                    {
                        value: luxon.DateTime.utc().minus({ days: 1 }).toFormat("yyyy-MM-dd"),
                        meta: { type: "date" },
                    },
                    {
                        value: luxon.DateTime.utc().minus({ days: 10 }).toFormat("yyyy-MM-dd"),
                        meta: { type: "date" },
                    },
                    {
                        value: luxon.DateTime.utc().minus({ days: 100 }).toFormat("yyyy-MM-dd"),
                        meta: { type: "date" },
                    },
                    {
                        value: luxon.DateTime.utc().plus({ days: 1 }).toFormat("yyyy-MM-dd"),
                        meta: { type: "date" },
                    },
                    {
                        value: luxon.DateTime.utc().plus({ days: 10 }).toFormat("yyyy-MM-dd"),
                        meta: { type: "date" },
                    },
                    {
                        value: luxon.DateTime.utc().plus({ days: 100 }).toFormat("yyyy-MM-dd"),
                        meta: { type: "date" },
                    },
                    { value: false, meta: { type: "datetime" } },
                    {
                        value: luxon.DateTime.utc().toFormat("yyyy-MM-dd HH:mm:ss"),
                        meta: { type: "datetime" },
                    },
                    {
                        value: luxon.DateTime.utc()
                            .minus({ days: 1 })
                            .toFormat("yyyy-MM-dd HH:mm:ss"),
                        meta: { type: "datetime" },
                    },
                    {
                        value: luxon.DateTime.utc()
                            .minus({ days: 10 })
                            .toFormat("yyyy-MM-dd HH:mm:ss"),
                        meta: { type: "datetime" },
                    },
                    {
                        value: luxon.DateTime.utc()
                            .minus({ days: 100 })
                            .toFormat("yyyy-MM-dd HH:mm:ss"),
                        meta: { type: "datetime" },
                    },
                    {
                        value: luxon.DateTime.utc()
                            .plus({ days: 1 })
                            .toFormat("yyyy-MM-dd HH:mm:ss"),
                        meta: { type: "datetime" },
                    },
                    {
                        value: luxon.DateTime.utc()
                            .plus({ days: 10 })
                            .toFormat("yyyy-MM-dd HH:mm:ss"),
                        meta: { type: "datetime" },
                    },
                    {
                        value: luxon.DateTime.utc()
                            .plus({ days: 100 })
                            .toFormat("yyyy-MM-dd HH:mm:ss"),
                        meta: { type: "datetime" },
                    },
                ],
            },
            {
                field: "selection",
                propsList: [
                    {
                        value: "todo",
                        isEditing: false,
                        meta: { selection: SELECTION_VALUES },
                    },
                    {
                        value: "ongoing",
                        isEditing: false,
                        meta: { selection: SELECTION_VALUES },
                    },
                    {
                        value: "done",
                        isEditing: false,
                        meta: { selection: SELECTION_VALUES },
                    },
                    {
                        value: "todo",
                        isEditing: true,
                        meta: { selection: SELECTION_VALUES },
                    },
                    {
                        value: "ongoing",
                        isEditing: true,
                        meta: { selection: SELECTION_VALUES },
                    },
                    {
                        value: "done",
                        isEditing: true,
                        meta: { selection: SELECTION_VALUES },
                    },
                ],
            },
            {
                field: "selection_badge",
                propsList: [{ value: false }],
            },
            {
                field: "statinfo",
                propsList: [
                    { value: false, meta: { type: "integer" } },
                    { value: 0, meta: { type: "integer" } },
                    { value: 10, meta: { type: "integer" } },
                    { value: false, meta: { type: "float" } },
                    { value: 0.0, meta: { type: "float" } },
                    { value: 10.0, meta: { type: "float" } },
                ],
            },
            {
                field: "state_selection",
                propsList: [{ value: false }],
            },
            {
                field: "statusbar",
                propsList: [{ value: false }],
            },
            {
                field: "text",
                propsList: [
                    { value: false, isEditing: false },
                    { value: "Hello world!", isEditing: false },
                    { value: false, isEditing: true },
                    { value: "Hello world!", isEditing: true },
                ],
            },
            {
                field: "toggle_button",
                propsList: [
                    {
                        value: false,
                        attrs: { options: { active: "Active", inactive: "Inactive" } },
                    },
                    { value: true, attrs: { options: { active: "Active", inactive: "Inactive" } } },
                ],
            },
            {
                field: "url",
                propsList: [
                    { value: false, attrs: { options: {} } },
                    { value: "www.google.com", attrs: { options: {} } },
                    {
                        value: "https://www.google.com",
                        attrs: { text: "Secured Google", options: {} },
                    },
                ],
            },
        ];
    }

    getFieldComponent(name) {
        return registry.category("fields").get(name);
    }
    getProps(override) {
        return Object.assign(
            {
                value: false,
                isEditing: false,
                attrs: {},
                options: {},
                meta: {},
            },
            override
        );
    }
}
FormView.template = xml/*xml*/ `
    <div>
        <t t-foreach="sections" t-as="section" t-key="section_index">
            <div class="p-2">
                <t t-set="comp" t-value="getFieldComponent(section.field)" />
                <h4 t-esc="comp.description or comp.name" />
                <t t-foreach="section.propsList" t-as="props" t-key="props_index">
                    <div>
                        <t t-component="comp" t-props="getProps(props)" class="o_field_widget" />
                    </div>
                </t>
                <hr />
            </div>
        </t>
    </div>
`;

FormView.type = "form";
FormView.display_name = "form";
FormView.multiRecord = false;

FormView.style = css/*scss*/ `
    .o_action_manager {
        overflow: auto !important;
    }
`;

registry.category("views").add("form", FormView);
