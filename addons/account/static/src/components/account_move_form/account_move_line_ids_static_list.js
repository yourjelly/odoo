import { StaticList } from "@web/model/relational_model/static_list";

export class AccountMoveLineIdsStaticList extends StaticList {
    /**
     * Override
     * Add the 'invoice_line_ids_mode' key inside the context when evaluating
     * the visibility of fields.
     */
    get evalContext() {
        const evalContext = super.evalContext;
        evalContext.context.invoice_line_ids_mode = this.model.invoiceLineIdsMode;
        return evalContext;
    }
}
