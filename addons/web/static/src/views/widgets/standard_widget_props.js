/** @odoo-module **/

import { Record as BasicRelationalModelRecord } from "../basic_relational_model";
import { Record as RelationalModelRecord } from "../relational_model";

export const standardWidgetProps = {
    readonly: { type: Boolean, optional: true },
    record: { type: [RelationalModelRecord, BasicRelationalModelRecord] },
};
