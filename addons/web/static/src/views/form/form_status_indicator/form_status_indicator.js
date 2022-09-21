/** @odoo-module **/

const { Component, useState } = owl;

export class FormStatusIndicator extends Component {
    setup() {
        this.state = useState({
            disableBtns: false,
        });
    }

    get displayButtons() {
        return this.indicatorMode !== "saved";
    }

    get indicatorMode() {
        if (this.props.model.root.isVirtual) {
            return this.props.model.root.isValid ? "dirty" : "invalid";
        } else if (!this.props.model.root.isValid) {
            return "invalid";
        } else if (this.props.model.root.isDirty) {
            return "dirty";
        } else {
            return "saved";
        }
    }

    async discard() {
        this.state.disableBtns = true;
        await this.props.discard();
        this.state.disableBtns = false;
    }
    async save() {
        this.state.disableBtns = true;
        await this.props.save();
        this.state.disableBtns = false;
    }
}
FormStatusIndicator.template = "web.FormStatusIndicator";
FormStatusIndicator.props = {
    model: Object,
    save: Function,
    discard: Function,
};
