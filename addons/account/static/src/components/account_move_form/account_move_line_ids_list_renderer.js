import { ListRenderer } from "@web/views/list/list_renderer";

export class AccountMoveLineIdsListRenderer extends ListRenderer {
    static recordRowTemplate = "account.AccountMoveLineIdsListRenderer.RecordRow";

    needDisplayRecord(record){
        return (
            !this.env.model.root.data.invoice_line_ids_mode
            || ["product", "line_section", "line_note"].includes(record.data.display_type)
        );
    }
};
