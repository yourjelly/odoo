import { Domain } from "@web/core/domain";
import { registry } from "@web/core/registry";
import { useBus } from "@web/core/utils/hooks";
import { X2ManyField, x2ManyField } from "@web/views/fields/x2many/x2many_field";
import { getFieldDomain } from "@web/model/relational_model/utils";
import { onWillUpdateProps } from "@odoo/owl";

import { AccountMoveLineIdsListRenderer } from "@account/components/account_move_form/account_move_line_ids_list_renderer";


class AccountMoveLineIdsField extends X2ManyField {
    static components = {
        ...X2ManyField.components,
        ListRenderer: AccountMoveLineIdsListRenderer,
    };
}

export const accountMoveLineIdsField = {
    ...x2ManyField,
    component: AccountMoveLineIdsField,
};

registry.category("fields").add("account_move_line_ids", accountMoveLineIdsField);
