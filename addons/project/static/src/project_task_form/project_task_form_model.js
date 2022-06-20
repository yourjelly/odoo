/** @odoo-module */

import { RelationalModel } from '@web/views/basic_relational_model';
import { ProjectTaskRecord } from './project_task_record';

export class ProjectTaskFormModel extends RelationalModel {}
ProjectTaskFormModel.Record = ProjectTaskRecord;
