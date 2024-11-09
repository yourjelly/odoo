import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/services/pos_store";

patch(PosStore.prototype, {
    getReceiptHeaderData(order) {
        const result = super.getReceiptHeaderData(...arguments);
        result.l10n_at_pos_session_uuid = order.session_id.l10n_at_pos_session_uuid;
        result.fiskaly_receipt_number = order.l10n_at_pos_order_receipt_number;
        result.is_fiskaly_receipt_signed = order.is_fiskaly_order_receipt_signed;
        return result;
    },
});
