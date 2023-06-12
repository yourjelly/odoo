/** @odoo-module */

import { onWillStart, useState } from "@odoo/owl";
import { _lt, _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { useBus } from "@web/core/utils/hooks";
import { selectionField, SelectionField } from "@web/views/fields/selection/selection_field";

const OPT_GROUPS = {
    values: { sequence: 10, name: _lt("Values Updated") },
    msging: { sequence: 20, name: _lt("Messaging") },
    timing: { sequence: 30, name: _lt("Timing Conditions") },
    manual: { sequence: 40, name: _lt("Manual Triggers") },
    custom: { sequence: 50, name: _lt("Custom") },
};

export class TriggerSelectionField extends SelectionField {
    static template = "base_automation.TriggerSelectionField";
    setup() {
        super.setup();
        this.model = this.props.record.model;
        this.relatedModel = useState({ fields: [] });
        onWillStart(async () => {
            this.relatedModel.fields = await this.fetchRelatedModelFields();
            this.computeDerivedOptions();
        });
        let lastRelatedModelId = this.props.record.data.model_id?.[0];
        useBus(this.model.bus, "update", async () => {
            const nextRelatedModelId = this.props.record.data.model_id?.[0];
            if (lastRelatedModelId !== nextRelatedModelId) {
                this.relatedModel.fields = await this.fetchRelatedModelFields();
                lastRelatedModelId = nextRelatedModelId;
                this.computeDerivedOptions();
            }
        });
    }

    async fetchRelatedModelFields() {
        const modelId = this.props.record.data.model_id?.[0];
        if (typeof modelId !== "number") {
            return [];
        }
        return await this.model.orm.call("ir.model.fields", "search_read", [], {
            fields: ["field_description", "name", "ttype", "relation"],
            domain: [["model_id", "=", modelId]],
        });
    }

    get value() {
        const value = super.value;
        return value === "smart" ? this.props.record.data.smart_details.select_value : value;
    }

    /**
     * @override
     */
    onChange(ev) {
        const value = JSON.parse(ev.target.value);
        const { showInput, onApply } = this.derivedOptions.find((o) => value === o.value);
        if (onApply && !showInput) {
            onApply();
            return;
        }
        super.onChange(ev);
    }

    onInputChange(ev) {
        const { value: inputValue } = ev.target;
        const selectedOption = this.derivedOptions.find((o) => this.value === o.value);
        if (selectedOption?.onApply) {
            selectedOption.onApply(inputValue);
        }
    }

    computeDerivedOptions() {
        const options = [];
        for (const field of this.relatedModel.fields) {
            if (field.name.endsWith("stage_id")) {
                const value = `smart_on_stage_update__${field.name}`;
                options.push({
                    groupKey: "values",
                    value,
                    label: `${_t("When the stage is set to...")} (${field.field_description})`,
                    showInput: true,
                    onApply: (text) => {
                        this.props.record.update({
                            [this.props.name]: "smart",
                            smart_details: {
                                select_value: value,
                                input_value: text,
                                data: { filter_domain: [[`${field.name}`, "ilike", `%${text}%`]] },
                            },
                        });
                    },
                });
            }
            if (["many2one", "many2many"].includes(field.ttype) && field.relation === "res.users") {
                const value = `smart_on_user_assign__${field.name}`;
                options.push({
                    groupKey: "values",
                    value,
                    label: `${_t("When assigning user...")} (${field.field_description})`,
                    showInput: true,
                    onApply: (text) => {
                        this.props.record.update({
                            [this.props.name]: "smart",
                            smart_details: {
                                select_value: value,
                                input_value: text,
                                data: { filter_domain: [[`${field.name}`, "ilike", `%${text}%`]] },
                            },
                        });
                    },
                });
            }
            if (["create_date", "write_date"].includes(field.name)) {
                const value = `smart_on_timing_update__${field.name}`;
                const label =
                    field.name === "create_date" ? _t("After creation") : _t("After last update");
                options.push({
                    groupKey: "timing",
                    value,
                    label: `${label} (${field.field_description})`,
                    onApply: () => {
                        this.props.record.update({
                            [this.props.name]: "smart",
                            smart_details: {
                                select_value: value,
                                data: { trg_date_id: [field.id] },
                            },
                        });
                    },
                });
            }
        }

        options.push(
            ...this.options.map(([value, label]) => ({ groupKey: "custom", value, label }))
        );

        this.derivedOptions = options;
    }

    get groupedOptions() {
        return this.derivedOptions
            .reduce((acc, option) => {
                const key = option.groupKey;
                let group = acc.find((g) => g.key === key);
                if (!group) {
                    group = { ...OPT_GROUPS[key], key, options: [] };
                    acc.push(group);
                }
                group.options.push(option);
                return acc;
            }, [])
            .sort((a, b) => a.sequence - b.sequence);
    }

    get showInput() {
        return this.derivedOptions.find((o) => this.value === o.value)?.showInput;
    }

    get inputValue() {
        return this.props.record.data.smart_details.input_value;
    }
}

export const triggerSelectionField = {
    ...selectionField,
    component: TriggerSelectionField,
};

registry.category("fields").add("base_automation.trigger_selection", triggerSelectionField);

// TODO: preload data, but needs new relational model
// function preloadTriggerSelectionField(orm, record, fieldName, { context, domain }) {
//     const modelId = record.data.model_id?.[0];
//     if (typeof modelId !== "number") {
//         return [];
//     }
//     return orm.call("ir.model.fields", "search_read", [], {
//         fields: ["field_description", "name", "ttype", "relation"],
//         domain: [["model_id", "=", modelId]],
//     });
// }

// registry.category("preloadedData").add("base_automation.trigger_selection", {
//     loadOnTypes: ["selection"],
//     preload: preloadTriggerSelectionField,
// });
