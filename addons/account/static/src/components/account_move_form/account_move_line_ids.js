import { Domain } from "@web/core/domain";
import { registry } from "@web/core/registry";
import { X2ManyField, x2ManyField } from "@web/views/fields/x2many/x2many_field";
import { getFieldDomain } from "@web/model/relational_model/utils";
import { onWillUpdateProps } from "@odoo/owl";

import { AccountMoveLineIdsListRenderer } from "@account/components/account_move_form/account_move_line_ids_list_renderer";


class AccountMoveLineIdsField extends X2ManyField {
    static components = {
        ...X2ManyField,
        ListRenderer: AccountMoveLineIdsListRenderer,
    };

    get isInvoiceLineIdsMode(){
        return this.env.model.root.data.invoice_line_ids_mode;
    }

    // Override.
    get list(){
        if(this.isInvoiceLineIdsMode){
            return this.props.record.data.invoice_line_ids;
        }
        return super.list;
    }
}

export const accountMoveLineIdsField = {
    ...x2ManyField,
    component: AccountMoveLineIdsField,
};

registry.category("fields").add("account_move_line_ids", accountMoveLineIdsField);
