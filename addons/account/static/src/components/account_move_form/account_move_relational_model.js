import { RelationalModel } from "@web/model/relational_model/relational_model";

import { AccountMoveRecord } from "@account/components/account_move_form/account_move_record";

export class AccountMoveRelationalModel extends RelationalModel {
    static Record = AccountMoveRecord;

    setup(params, { action, company, dialog, notification }) {
        super.setup(...arguments);
        this.invoiceLineIdsMode = false;
    }

    switchToInvoiceLineIdsMode(mode) {
        this.invoiceLineIdsMode = mode;
    }
}
