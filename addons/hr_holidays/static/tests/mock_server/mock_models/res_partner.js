import { fields } from "@web/../tests/web_test_helpers";
import { mailModels } from "addons/mail/static/tests/mail_test_helpers";

export class ResPartner extends mailModels.ResPartner {
    out_of_office_date_end = fields.Date({ string: "out of office" });
}
