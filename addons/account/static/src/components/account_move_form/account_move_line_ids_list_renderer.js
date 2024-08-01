import { ListRenderer } from "@web/views/list/list_renderer";

import { useState } from "@odoo/owl";

export class AccountMoveLineIdsListRenderer extends ListRenderer {
    static recordRowTemplate = "account.AccountMoveLineIdsListRenderer.RecordRow";

    needDisplayRecord(record){
        return (
            !this.env.model.invoiceLineIdsMode
            || ["product", "line_section", "line_note"].includes(record.data.display_type)
        );
    }
};
