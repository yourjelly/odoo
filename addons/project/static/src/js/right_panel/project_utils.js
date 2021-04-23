/** @odoo-module **/

import { _lt } from 'web.core';
import { ComponentAdapter } from 'web.OwlCompatibility';
import { FormViewDialog } from 'web.view_dialogs';
const { useState, useRef } = owl.hooks;

export class FormViewDialogComponentAdapter extends ComponentAdapter {
    renderWidget() {
        // Ensure the dialog is properly reconstructed. Without this line, it is
        // impossible to open the dialog again after having it closed a first
        // time, because the DOM of the dialog has disappeared.
        return this.willStart();
    }
}

const components = {
    FormViewDialogComponentAdapter,
};

class MilestoneComponent extends owl.Component {
    constructor() {
        super(...arguments);
        this.contextValue = Object.assign({}, {
            'default_project_id': this.props.context.active_id,
        }, this.props.context);
        this.FormViewDialog = FormViewDialog;
        this.state = useState({
            openDialog: false
        });
        this._dialogRef = useRef('dialog');
        this._isDialogOpen = false;
        this._onDialogSaved = this._onDialogSaved.bind(this);
    }

    get context() {
        return this.contextValue;
    }

    set context(value) {
        this.contextValue = Object.assign({}, {
            'default_project_id': value.active_id,
        }, value);
    }

    _onDialogSaved() {
        this.__owl__.parent.willUpdateProps();
    }
}
MilestoneComponent.components = components;

export class AddMilestone extends MilestoneComponent {
    get NEW_PROJECT_MILESTONE() {
        return _lt("New Project Milestone");
    }

    patched() {
        if (this.state.openDialog && !this._isDialogOpen) {
            this._isDialogOpen = true;
            this._dialogRef.comp.widget.on('closed', this, () => {
                this._isDialogOpen = false;
                this.state.openDialog = false;
            });
            this._dialogRef.comp.widget.open();
        }
    }

    onAddMilestoneClick() {
        if (!this._isDialogOpen) {
            this.state.openDialog = true;
        }
    }
}
AddMilestone.template = 'project.AddMilestone';

export class OpenMilestone extends MilestoneComponent {
    constructor() {
        super(...arguments);
        this.contextValue = Object.assign({}, {
            'default_project_id': this.props.context.active_id,
        }, this.props.context);
        this.FormViewDialog = FormViewDialog;
        this.milestone = useState(this.props.milestone);
        this.state = useState({
            openDialog: false,
            colorClass: this.milestone.is_deadline_exceeded ? "o_milestone_danger" : "",
            checkboxIcon: this.milestone.is_done ? "fa-check-square" : "fa-square-o",
        });
        this._dialogRef = useRef('dialog');
        this._isDialogOpen = false;
        this._onDialogSaved = this._onDialogSaved.bind(this);
    }

    get OPEN_PROJECT_MILESTONE() {
        return _lt("Project Milestone");
    }

    get context() {
        return this.contextValue;
    }

    set context(value) {
        this.contextValue = Object.assign({}, {
            'default_project_id': value.active_id,
        }, value);
    }

    async willUpdateProps(nextProps) {
        if (nextProps.milestone) {
            this.milestone = nextProps.milestone;
            this.state.colorClass = this.milestone.is_deadline_exceeded ? "o_milestone_danger" : "";
            this.state.checkboxIcon = this.milestone.is_done ? "fa-check-square" : "fa-square-o";
        }
        if (nextProps.context) {
            this.contextValue = nextProps.context;
        }
    }

    patched() {
        if (this.state.openDialog && !this._isDialogOpen) {
            this._isDialogOpen = true;
            this._dialogRef.comp.widget.on('closed', this, () => {
                this._isDialogOpen = false;
                this.state.openDialog = false;
                this.write_mutex = false;
            });
            this._dialogRef.comp.widget.open();
        }
    }

    onOpenMilestone() {
        if (!this._isDialogOpen && !this.write_mutex) {
            this.write_mutex = true;
            this.state.openDialog = true;
        }
    }

    async onDeleteMilestone() {
        await this.rpc({
            model: 'project.milestone',
            method: 'unlink',
            args: [this.milestone.id]
        });
        this.__owl__.parent.willUpdateProps();
    }

    async onMilestoneClick() {
        if (!this.write_mutex) {
            this.write_mutex = true;
            this.milestone = await this.rpc({
                model: 'project.milestone',
                method: 'mark_as_done',
                args: [[this.milestone.id], {is_done: !this.milestone.is_done}],
            });
            this.state.colorClass = this.milestone.is_deadline_exceeded ? "o_milestone_danger" : "";
            this.state.checkboxIcon = this.milestone.is_done ? "fa-check-square" : "fa-square-o";
            this.write_mutex = false;
        }
    }

    _onDialogSaved() {
        this.__owl__.parent.willUpdateProps();
    }
}
OpenMilestone.template = 'project.OpenMilestone';
