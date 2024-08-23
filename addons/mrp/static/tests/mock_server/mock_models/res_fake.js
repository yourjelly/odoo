import { DEFAULT_MAIL_VIEW_ID } from "@mail/../tests/mock_server/mock_models/constants";
import { fields, models } from "@web/../tests/web_test_helpers";

export class ResFake extends models.Model {
    _name = "res.fake";
    _views = {
        [`form,${DEFAULT_MAIL_VIEW_ID}`]: /* xml */ `
            <form>
                <field name="duration" widget="mrp_timer" readonly="1"/>
            </form>`,
    };
    duration = fields.Float({ string: "duration" });
}
