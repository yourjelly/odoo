/** @odoo-module */

import legacyRegistry from 'web.field_registry';
import { FieldStatus } from 'web.relational_fields';
import { registry } from "@web/core/registry";
import { StatusBarField } from '@web/views/fields/statusbar/statusbar_field';

export class ProjectTaskStageStatusBarField extends StatusBarField {
    get model() {
        return this.env.model;
    }

    get orm() {
        return this.model.orm;
    }

    get actionService() {
        return this.model.actionService;
    }

    async selectItem(item) {
        await super.selectItem(item);
        if (item.isFolded && this.props.record.data.milestone_id) {
            const action = await this.orm.call(
                this.props.record.resModel,
                'get_milestone_to_mark_as_reached_action',
                [this.model.root.resIds],
            );
            if (action) {
                this.actionService.doAction(action);
            }
        }
    }
}

registry.category("fields").add("project_task_stage_statusbar", ProjectTaskStageStatusBarField);
const preloadRegistry = registry.category('preloadedData');
preloadRegistry.add('project_task_stage_statusbar', preloadRegistry.get('statusbar', {}));

legacyRegistry.add('project_task_stage_statusbar', FieldStatus); // FIXME: it is to use specialData function defined in the statusbar legacy widget used in the BasicModel.
