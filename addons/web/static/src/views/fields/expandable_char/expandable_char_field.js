/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { archParseBoolean } from "@web/views/utils";
import { standardFieldProps } from "../standard_field_props";
import { TranslationButton } from "../translation_button";

import { useRef, useState } from "@odoo/owl";
import { CharField } from "../char/char_field";

export class ExpandableCharField extends CharField {
    setup() {
        super.setup();
        this.input = useRef("input");
        this.state = useState({ value: this.props.value || "" });
    }

    onInput(ev) {
        this.state.value = this.input.el.value;
    }
}


ExpandableCharField.template = "web.ExpandableCharField";
ExpandableCharField.components = {
    TranslationButton,
};

registry.category("fields").add("expandable_char", ExpandableCharField);
