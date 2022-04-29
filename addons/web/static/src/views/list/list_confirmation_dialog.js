/** @odoo-module */

import { Dialog } from "@web/core/dialog/dialog";
import { _lt } from "@web/core/l10n/translation";

const { Component } = owl;

export class ListConfirmationDialog extends Component {
    setup() {
        this.isDomainSelected = this.props.isDomainSelected;
        this.nbRecords = this.props.nbRecords;
        this.nbValidRecords = this.props.nbValidRecords;
        this.fields = this.props.fields;
    }

    _cancel() {
        if (this.props.cancel) {
            this.props.cancel();
        }
        this.props.close();
    }

    _confirm() {
        if (this.props.confirm) {
            this.props.confirm();
        }
        this.props.close();
    }
}
ListConfirmationDialog.template = "web.ListView.ConfirmationModal";
ListConfirmationDialog.components = { Dialog };
ListConfirmationDialog.props = {
    close: Function,
    title: {
        validate: (m) => {
            return (
                typeof m === "string" || (typeof m === "object" && typeof m.toString === "function")
            );
        },
        optional: true,
    },
    confirm: { type: Function, optional: true },
    cancel: { type: Function, optional: true },
    isDomainSelected: Boolean,
    fields: Object,
    nbRecords: Number,
    nbValidRecords: Number,
};
ListConfirmationDialog.defaultProps = {
    title: _lt("Confirmation"),
};
