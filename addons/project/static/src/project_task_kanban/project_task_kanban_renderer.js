/** @odoo-module */

import { KanbanRenderer } from '@web/views/kanban/kanban_renderer';
import { FormViewDialog } from "@web/views/view_dialogs/form_view_dialog";

export class ProjectTaskKanbanRenderer extends KanbanRenderer {
    get canMoveRecords() {
        let canMoveRecords = super.canMoveRecords;
        if (!canMoveRecords && this.canResequenceRecords && this.props.list.groupByField.name === 'personal_stage_type_ids') {
            const { groupByField } = this.props.list;
            const { modifiers } = groupByField;
            canMoveRecords = !(modifiers && modifiers.readonly);
        }
        return canMoveRecords;
    }

    get isGroupedByPersonalStages() {
        if (!this.props.list.groupByField) {
            return false;
        }
        return this.props.list.groupByField.name === 'personal_stage_type_ids';
    }

    canCreateGroup() {
        return super.canCreateGroup() || this.isGroupedByPersonalStages;
    }

    canDeleteGroup(group) {
        return super.canDeleteGroup(group) || this.isGroupedByPersonalStages;
    }

    canEditGroup(group) {
        return super.canEditGroup(group) || this.isGroupedByPersonalStages;
    }

    async deleteGroup(group) {
        if (group && group.groupByField.name === 'stage_id') {
            const action = await group.model.orm.call(group.resModel, 'unlink_wizard', [group.resId]);
            this.action.doAction(action);
            return;
        }
        super.deleteGroup(group);
    }

    editGroup(group) {
        const groupBy = this.props.list.groupBy;
        if (groupBy.length !== 1 || groupBy[0] !== 'personal_stage_type_ids') {
            super.editGroup(group);
            return;
        }
        const context = Object.assign({}, group.context, {
            form_view_ref: 'project.personal_task_type_edit',
        });
        this.dialog.add(FormViewDialog, {
            context,
            resId: group.value,
            resModel: group.resModel,
            title: this.env._t('Edit Personal Stage'),
            onRecordSaved: async () => {
                await this.props.list.load();
                this.props.list.model.notify();
            },
        });
    }
}
