/** @odoo-module */

import { KanbanModel } from "@web/views/kanban/kanban_model";

import { ProjectTaskRecord } from './project_task_kanban_record';

export class ProjectTaskKanbanModel extends KanbanModel { }

ProjectTaskKanbanModel.Record = ProjectTaskRecord;
