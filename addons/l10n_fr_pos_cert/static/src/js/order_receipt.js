import { OrderReceipt } from "@point_of_sale/app/screens/receipt_screen/receipt/order_receipt";
import { patch } from "@web/core/utils/patch";

patch(OrderReceipt, {
    props: {
        ...OrderReceipt.props,
        simplified_receipt: { type: Boolean, optional: true },
    },
    defaultProps: {
        ...OrderReceipt.defaultProps,
        simplified_receipt: false,
    },
});

patch(OrderReceipt.prototype, {
    updateLines() {
        const customerCount = this.props.data.headerData.customer_count;
        if (!customerCount || !this.props.simplified_receipt) {
            return this.props.data.orderlines;
        }

        let customerCost = (this.props.data.amount_total / customerCount).toFixed(2);
        const { suffix, symbol } = this.props.data.currency_details;
        customerCost = suffix ? customerCost + ` ${symbol}` : `${symbol} ` + customerCost;

        const simplifiedLines = Array.from({ length: customerCount }, (_, index) => ({
            productName: `Menu ${index + 1}`,
            price: customerCost,
            qty: "1.00",
            unitPrice: customerCost,
            unit: "Units",
        }));
        return simplifiedLines;
    },
});
