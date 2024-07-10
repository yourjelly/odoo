import { fields } from "@web/../tests/web_test_helpers";
import { projectModels } from "@project/../tests/project_models";

export class ProjectTask extends projectModels.ProjectTask {
    _name = "project.task";

    company_id = fields.Many2one({ string: "Company", relation: "res.company" });
    tag_ids = fields.Many2many({ relation: "project.tags" });
    personal_stage_type_id = fields.Many2one({ relation: "project.task.stage.personal" });

    _records = [
        {
            id: 1,
            name: "Todo 1",
            state: "01_in_progress",
            tag_ids: [1],
            personal_stage_type_id: 1,
        },
        {
            id: 2,
            name: "Todo 2",
            state: "1_done",
            tag_ids: [3],
            personal_stage_type_id: 2,
        },
        {
            id: 3,
            name: "Todo 3",
            state: "01_in_progress",
            tag_ids: [3, 2],
            personal_stage_type_id: 3,
        },
    ];
}
