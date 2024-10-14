import { ReceiptScreen } from "@point_of_sale/app/screens/receipt_screen/receipt_screen";
import { patch } from "@web/core/utils/patch";
import { OrderReceipt } from "@point_of_sale/app/screens/receipt_screen/receipt/order_receipt";
import { useTrackedAsync } from "@point_of_sale/app/utils/hooks";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";

patch(ReceiptScreen.prototype, {
    setup() {
        super.setup(...arguments);
        this.doSimplifiedPrint = useTrackedAsync(() => this.pos.printReceipt({ simplified: true }));
    },
    async generateTicketImage(isBasicReceipt = false, isSimplifiedReceipt = false) {
        await this.renderer.toJpeg(
            OrderReceipt,
            {
                data: this.pos.orderExportForPrinting(this.pos.get_order()),
                formatCurrency: this.env.utils.formatCurrency,
                basic_receipt: isBasicReceipt,
                simplified_receipt: isSimplifiedReceipt,
            },
            { addClass: "pos-receipt-print p-3" }
        );
    },
    async _sendReceiptToCustomer({ action, destination }) {
        const order = this.currentOrder;
        if (typeof order.id !== "number") {
            this.dialog.add(ConfirmationDialog, {
                title: _t("Unsynced order"),
                body: _t(
                    "This order is not yet synced to server. Make sure it is synced then try again."
                ),
            });
            return Promise.reject();
        }
        const fullTicketImage = await this.generateTicketImage();
        const basicTicketImage = await this.generateTicketImage(true);
        const simplifiedTicketImage = await this.generateTicketImage(false, true);
        await this.pos.data.call("pos.order", action, [
            [order.id],
            destination,
            fullTicketImage,
            this.pos.basic_receipt ? basicTicketImage : null,
            this.pos.simplified_receipt ? simplifiedTicketImage : null,
        ]);
    },
});
