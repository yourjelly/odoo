/** @odoo-module */

import { PosStore } from "@point_of_sale/app/store/pos_store";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { OrderReceipt } from "@point_of_sale/app/screens/receipt_screen/receipt/order_receipt";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";

patch(PosStore.prototype, {
    is_french_country() {
        const french_countries = ["FR", "MF", "MQ", "NC", "PF", "RE", "GF", "GP", "TF"];
        if (!this.company.country_id) {
            this.dialog.add(AlertDialog, {
                title: _t("Missing Country"),
                body: _t("The company %s doesn't have a country set.", this.company.name),
            });
            return false;
        }
        return french_countries.includes(this.company.country_id?.code);
    },
    async printReceipt({ basic = false, order = this.get_order(), simplified = false } = {}) {
        await this.printer.print(
            OrderReceipt,
            {
                data: this.orderExportForPrinting(order),
                formatCurrency: this.env.utils.formatCurrency,
                basic_receipt: basic,
                simplified_receipt: simplified,
            },
            { webPrintFallback: true }
        );
        const nbrPrint = order.nb_print;
        await this.data.write("pos.order", [order.id], { nb_print: nbrPrint + 1 });
        return true;
    },
});
