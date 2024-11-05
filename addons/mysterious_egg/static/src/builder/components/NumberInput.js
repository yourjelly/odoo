import { Component, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";

const actionsRegistry = registry.category("website-builder-actions");

export class NumberInput extends Component {
    static template = "mysterious_egg.NumberInput";
    static props = {
        actions: Object,
        unit: { type: String, optional: true },
        applyTo: { type: Function, optional: true },
    };

    setup() {
        const [actionId, actionParams] = Object.entries(this.props.actions)[0];
        this.state = useState({
            value: actionsRegistry.get(actionId).getValue({
                editingElement: this.getEditingElement(),
                params: actionParams,
            }),
        });
        this.applyValue = this.env.editor.shared.makePreviewableOperation(
            this._applyValue.bind(this)
        );
    }
    onChange(e) {
        this.applyValue.commit(e.target.value);
    }
    onInput(e) {
        this.applyValue.preview(e.target.value);
    }
    _applyValue(value) {
        for (const [actionId, actionParams] of Object.entries(this.props.actions)) {
            actionsRegistry.get(actionId).apply({
                editingElement: this.getEditingElement(),
                params: { value, ...actionParams },
            });
        }
    }
    getEditingElement() {
        return this.props.applyTo
            ? this.env.editingElement.querySelector(this.props.applyTo)
            : this.env.editingElement;
    }
}
