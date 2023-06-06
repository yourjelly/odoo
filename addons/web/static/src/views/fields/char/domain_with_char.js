/** @odoo-module */

import { CharField, charField } from "@web/views/fields/char/char_field";
import { registry } from "@web/core/registry";
import { ModelFieldSelector } from "@web/core/model_field_selector/model_field_selector";
import { TranslationButton } from "../translation_button";
import { ModelFieldSelectorPopover } from "@web/core/model_field_selector/model_field_selector_popover";
import { useState } from "@odoo/owl";
import { browser } from "@web/core/browser/browser";

export class DomainCharField extends CharField {
    static components = {
        TranslationButton,
        ModelFieldSelector,
        ModelFieldSelectorPopover,
    };

    setup() {
        this.state = useState({
            domain: "",
        });
    }

    get domainSelectorProps() {
        return {
            path: this.state.domain,
            resModel: this.props.record.resModel,
            readonly: this.props.readonly,
            update: (domainStr) => {
                this.state.domain = domainStr;
            },
            isDebugMode: !!this.env.debug,
        };
    }
    async onCopy() {
        browser.navigator.clipboard.writeText(this.state.domain);
    }

}

DomainCharField.template = "web.DomainCharField";

export const domainCharField = {
    ...charField,
    component: DomainCharField,
};


registry.category("fields").add("domain_with_char", domainCharField);
