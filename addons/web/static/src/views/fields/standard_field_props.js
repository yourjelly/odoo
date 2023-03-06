/** @odoo-module **/

import { Record as BasicRelationalModelRecord } from "../basic_relational_model";
import { Record as RelationalModelRecord } from "../relational_model";

export const standardFieldProps = {
    id: { type: String, optional: true },
    name: { type: String, optional: true },
    readonly: { type: Boolean, optional: true },
    record: { type: [RelationalModelRecord, BasicRelationalModelRecord] },
    value: true,
};
