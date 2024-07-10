import { fields, models } from "@web/../tests/web_test_helpers";

export class ProjectTags extends models.Model {
    _name = "project.tags";

    name = fields.Char();
    color = fields.Integer();

    _records = [
        {
            id: 1,
            name: "Tag 1",
            color: 1,
        },
        {
            id: 2,
            name: "Tag 2",
            color: 5,
        },
        {
            id: 3,
            name: "Tag 3",
            color: 10,
        },
    ];
}

export class ProjectTaskStagePersonal extends models.Model {
    _name = "project.task.stage.personal";

    task_id = fields.Many2one({ relation: "project.task"})
    user_id = fields.Many2one({ relation: "res.users" })
    stage_id = fields.Many2one({ relation: "project.task.type"})

    _records = [
        {
            id: 1,
            task_id: 1,
            user_id: 7,
            stage_id: 1,
        },
        {
            id: 2,
            task_id: 2,
            user_id: 7,
            stage_id: 2,
        },
        {
            id: 3,
            task_id: 3,
            user_id: 7,
            stage_id: 3,
        }
    ]
}
