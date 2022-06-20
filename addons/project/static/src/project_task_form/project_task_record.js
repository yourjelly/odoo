/** @odoo-module */

import { Record } from '@web/views/basic_relational_model';

export class ProjectTaskRecord extends Record {
    setup(params, state) {
        super.setup(params, state);
        this.tasksFoldedWithMilestone = new Set();
    }

    async update(changes) {
        await super.update(changes);
        const foldedStages = 'stage_id' in this.preloadedData
            ? this.preloadedData.stage_id.filter(stage => stage.fold)
            : [];
        if (!foldedStages) {
            return;
        }
        const subtaskIds = [];
        const taskDependencyIds = [];
        for (const [fieldName, value] of Object.entries(changes)) {
            if (
                ['child_ids', 'depend_on_ids'].includes(fieldName)
                && value.data
                && 'stage_id' in value.data
                && value.data.stage_id
            ) {
                if (fieldName === 'child_ids') {
                    subtaskIds.push(value.id);
                } else {
                    taskDependencyIds.push(value.id);
                }
            }
        }
        this._setTasksFoldedWithMilestone('child_ids', subtaskIds);
        this._setTasksFoldedWithMilestone('depend_on_ids', taskDependencyIds);
    }

    async save(options = { stayInEdition: false, noReload: false, savePoint: false }) {
        const result = await super.save(options);
        if (this.tasksFoldedWithMilestone.size) {
            const action = await this.model.orm.call(
                this.resModel,
                'get_milestone_to_mark_as_reached_action',
                [[...this.tasksFoldedWithMilestone]],
            );
            if (action) {
                this.model.actionService.doAction(action);
            }
        }
        return result;
    }

    _setTasksFoldedWithMilestone(fieldName, candidatTaskIds) {
        if (candidatTaskIds.length) {
            for (const task of this.data[fieldName].records) {
                if (candidatTaskIds.includes(task.__bm_handle__) && task.data.milestone_id) {
                    this.tasksFoldedWithMilestone.add(task.resId);
                }
            }
        }
    }
}
