import { Notebook } from "@web/core/notebook/notebook";

import { useEffect } from "@odoo/owl";

export class AccountMoveNotebook extends Notebook {
    static template = "account.AccountMoveNotebook";

    setup(){
        super.setup();
        this.lineIdsPage = this.pages.find((e) => e[1].name === "aml_tab");
        this.invoiceLineIdsPage = this.pages.find((e) => e[1].name === "invoice_tab");
        this.env.model.switchToInvoiceLineIdsMode(this.state.currentPage === this.invoiceLineIdsPage[0]);
    }

    // Override
    async activatePage(pageIndex) {
        this.env.model.switchToInvoiceLineIdsMode(pageIndex === this.invoiceLineIdsPage[0]);
        super.activatePage(pageIndex);
    }
}
