/** @odoo-module */
import { patch } from "@web/core/utils/patch";
import { TicketScreen } from "@point_of_sale/app/screens/ticket_screen/ticket_screen";
import { _t } from "@web/core/l10n/translation";

patch(TicketScreen.prototype, {
    _getSearchFields() {
        const fields = super._getSearchFields(...arguments);
        if (!this.pos.config.is_spanish) {
            return fields;
        }
        fields.SIMPLIFIED_INVOICE = {
            repr: (order) => order.name,
            displayName: _t("Simplified Invoice"),
            modelField: "l10n_es_unique_id",
        };
        return fields;
    },
});
