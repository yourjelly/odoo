/** odoo-module */

import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

registry.category("web_tour.tours").add("marketing_card_tour", {
    test: true,
    url: "/web",
    steps: () => [
        stepUtils.showAppsMenuItem(),
        {
            // create a new campaign
            trigger: ".o_app[data-menu-xmlid='marketing_card.card_menu']",
        },
        {
            trigger: "button.o_list_button_add",
        },
        {
            trigger: "div[name='name'] input",
            run: "text Test Tour Marketing Card",
        },
        {
            // set subheader to "Hello"
            trigger: "div[name='card_element_ids'] table td[data-tooltip='Sub-Header']",
        },
        {
            // field cannot be selected until form is saved (to sync the model)
            trigger: "div[name='value_type'] input[data-value='field'][disabled]",
            isCheck: true,
        },
        {
            trigger: "div[name='card_element_text'] textarea",
            run: "text Hello",
        },
        {
            trigger: "div.modal-dialog button.o_form_button_save",
        },
        ...stepUtils.saveForm(),
        {
            // set header to "partner.name"
            trigger: "div[name='card_element_ids'] table td[data-tooltip='Header']",
        },
        {
            trigger: "div[name='value_type'] input[data-value='field']",
        },
        {
            trigger: "div[name='field_path'] .o_model_field_selector.o_input",
        },
        {
            trigger: ".o_popover li[data-name='name'] button",
            in_modal: false,
        },
        {
            trigger: "div.modal-dialog button.o_form_button_save",
        },
        {
            // set image to image_512
            trigger: "div[name='card_element_ids'] table td[data-tooltip='Image 1']",
        },
        {
            trigger: "div[name='value_type'] input[data-value='field']",
        },
        {
            trigger: "div[name='field_path'] .o_model_field_selector.o_input",
        },
        {
            // image elements shouldn't show non-image fields
            trigger: ".o_popover:not(:has(li[data-name='name']))",
            isCheck: true,
            in_modal: false,
        },
        {
            trigger: ".o_popover li[data-name='image_512'] button",
            in_modal: false,
        },
        {
            trigger: "div.modal-dialog button.o_form_button_save",
        },
        {
            // switch template
            trigger: "div[name='card_template_id'] span:contains('Lila')",
        },
        {
            // switch preview record
            trigger: "div[name='preview_record_ref'] select",
            run: "text res.partner",
        },
        {
            trigger: "div[name='preview_record_ref'] .o_field_many2one_selection input",
        },
        {
            trigger: "div[name='preview_record_ref'] .o_field_many2one_selection li.o-autocomplete--dropdown-item",
        },
        {
            // send to every partner
            trigger: "button[name='action_share']",
        },
        {
            trigger: "div[name='message'] .note-editable",
            run: "text Hi, this is only a test",
        },
        {
            trigger: "div.modal-dialog button[name='action_send']",
        },
        {
            trigger: "div[name='card_count']:not(:contains('0'))",
            isCheck: true,
        },
        {
            // go back and copy
            trigger: ".breadcrumb-item a",
        },
        {
            trigger: ".o_data_row:contains('Test Tour Marketing Card') .o_list_record_selector input",
        },
        {
            trigger: ".o_cp_action_menus button",
        },
        {
            trigger: ".o-dropdown-item:contains('Duplicate')",
        },
        {
            // wait for copy to complete
            trigger: ".o_list_renderer tbody .o_data_row:nth-child(2) td[name='name']:contains('Test Tour Marketing Card')",
            isCheck: true,
        },
        {
            trigger: ".o_list_renderer tbody .o_data_row:nth-child(1) td[name='name']:contains('Test Tour Marketing Card')",
        },
        {
            trigger: "div[name='card_count']:contains('0')",
            isCheck: true,
        },
        {
            trigger: "div[name='name']",
        },
        {
            trigger: "div[name='name'] input",
            run: "text Test Tour Marketing Card Mailing",
        },
        {
            // create a new mailing
            trigger: ".o_menu_brand",
        },
        {
            trigger: ".o_app[data-menu-xmlid='mass_mailing.mass_mailing_menu_root']",
        },
        {
            trigger: "button.o_list_button_add",
        },
        {
            trigger: "div[name='subject'] input",
            run: "text Test Tour Marketing Card Mailing",
        },
        {
            // select "from scratch" and drop a share card widget on "mailing list" -> no card
            trigger: ":iframe div.o_mail_theme_selector_new a.dropdown-item:contains('Scratch')",
        },
        {
            trigger: "div[name='Share a Card'].oe_snippet .oe_snippet_thumbnail:not(.o_we_already_dragging)",
            run: "drag_and_drop_native :iframe div[contenteditable='true']",
        },
        {
            trigger: ":iframe .s_call_to_share_card",
        },
        {
            trigger: "we-title:contains('Marketing Card')",
            isCheck: true,
        },
        {
            trigger: "we-select[data-name='cards_campaign_picker_opt'] we-toggler",
        },
        {
            trigger: "we-select[data-name='cards_campaign_picker_opt'] we-selection-items",
            extra_trigger: "we-selection-items:not(:has(we-button))",
            isCheck: true,
        },
        {
            // change to res.partner model
            trigger: "div[name='mailing_model_id'] input",
            run: "text res.partner",
        },
        {
            trigger: ".o-autocomplete.dropdown a.dropdown-item:contains('Contact')",
        },
        {
            // changing model should remove the card
            trigger: ":iframe body:not(:has(.s_call_to_share_card))",
            isCheck: true,
        },
        {
            // save without picking a card for the snippet
            trigger: "button.o_we_add_snippet_btn",
        },
        {
            trigger: "div[name='Share a Card'].oe_snippet .oe_snippet_thumbnail:not(.o_we_already_dragging)",
            run: "drag_and_drop_native :iframe div[contenteditable='true']",
        },
        {
            trigger: ":iframe .s_call_to_share_card",
        },
        {
            trigger: "we-select[data-name='cards_campaign_picker_opt'] we-toggler",
        },
        {
            trigger: "we-select[data-name='cards_campaign_picker_opt'] we-selection-items:has(we-button)",
            isCheck: true,
        },
        ...stepUtils.saveForm(),
        {
            // pick a card and save
            trigger: ":iframe body:not(:has(.s_call_to_share_card))",
            isCheck: true,
        },
        {
            trigger: ":iframe div.o_mail_theme_selector_new a.dropdown-item:contains('Scratch')",
        },
        {
            trigger: "button.o_we_add_snippet_btn",
        },
        {
            trigger: "div[name='Share a Card'].oe_snippet .oe_snippet_thumbnail:not(.o_we_already_dragging)",
            run: "drag_and_drop_native :iframe div[contenteditable='true']",
        },
        {
            trigger: ":iframe .s_call_to_share_card",
        },
        {
            trigger: "we-select[data-name='cards_campaign_picker_opt'] we-toggler",
        },
        {
            trigger: "we-select[data-name='cards_campaign_picker_opt'] we-selection-items we-button:contains('Test Tour Marketing Card Mailing')",
        },
        ...stepUtils.saveForm(),
        {
            trigger: ":iframe .s_call_to_share_card",
            isCheck: true,
        },
        {
            trigger: "button[name='action_launch']",
        },
        {
            trigger: ".btn.btn-primary:contains('Send to all')",
        },
        {
            trigger: "span[name='mailing_schedule_type_now_text']",
            isCheck: true,
        },
        {
            trigger: ".o_menu_brand",
        },
    ],
});
