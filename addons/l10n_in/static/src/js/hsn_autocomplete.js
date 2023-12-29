/** @odoo-module **/

import { AutoComplete } from "@web/core/autocomplete/autocomplete";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { CharField, charField } from "@web/views/fields/char/char_field";
import { useService } from "@web/core/utils/hooks";

export class HsnAutoComplete extends CharField {
    static template = "hsn_autocomplete.HsnAutoComplete";
    static components = {
        ...CharField.components,
        AutoComplete,
    };
    setup() {
        super.setup();
        this.orm = useService("orm");
    }

    get sources() {
        return [
            {
                options: async (request) => {
                    if (request?.length > 2) {
                        return await this.orm.call("product.template", "get_hsn_suggestions", [
                            request,
                        ]);
                    } else {
                        return [];
                    }
                },
                optionTemplate: "hsn_autocomplete.DropdownOption",
                placeholder: _t("Searching..."),
            },
        ];
    }

    onSelect(option) {
        const data = { [this.props.name]: option.c };
        if (this.props.hsn_description_field) {
            data[this.props.hsn_description_field] = option.n;
        }
        this.props.record.update(data);
    }
}

export const hsnAutoComplete = {
    ...charField,
    component: HsnAutoComplete,
    supportedOptions: [
        {
            label: _t("Hsn description field"),
            name: "hsn_description_field",
            type: "string",
        },
    ],
    supportedTypes: ["char"],
    extractProps: ({ options }) => ({
        hsn_description_field: options.hsn_description_field,
    }),
};

registry.category("fields").add("hsn_autocomplete", hsnAutoComplete);
