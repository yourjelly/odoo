import * as Chrome from "@point_of_sale/../tests/tours/utils/chrome_util";
import * as Dialog from "@point_of_sale/../tests/tours/utils/dialog_util";
import * as ProductScreen from "@point_of_sale/../tests/tours/utils/product_screen_util";
import * as PaymentScreen from "@point_of_sale/../tests/tours/utils/payment_screen_util";
import * as ReceiptScreen from "@point_of_sale/../tests/tours/utils/receipt_screen_util";
import { registry } from "@web/core/registry";

registry
    .category("web_tour.tours")
    .add("test_cash_rounding_add_invoice_line_not_only_round_cash_method", {
        steps: () =>
            [
                Chrome.startPoS(),
                Dialog.confirm("Open Register"),

                // First order.
                ProductScreen.addOrderline("random_product", "1"),
                ProductScreen.clickPartnerButton(),
                ProductScreen.clickCustomer("partner_a"),
                ProductScreen.clickPayButton(),

                PaymentScreen.totalIs("15.70"),
                PaymentScreen.clickPaymentMethod("Cash", true, { remaining: "0.0" }),

                PaymentScreen.clickInvoiceButton(),
                PaymentScreen.clickValidate(),

                ReceiptScreen.receiptAmountTotalIs("15.72"),
                ReceiptScreen.receiptRoundingAmountIs("-0.02"),
                ReceiptScreen.receiptToPayAmountIs("15.70"),
                ReceiptScreen.receiptChangeAmountIsNotThere(),
                ReceiptScreen.clickNextOrder(),

                // Second order.
                ProductScreen.addOrderline("random_product", "1"),
                ProductScreen.clickPartnerButton(),
                ProductScreen.clickCustomer("partner_a"),
                ProductScreen.clickPayButton(),

                PaymentScreen.totalIs("15.70"),
                PaymentScreen.clickPaymentMethod("Bank"),
                PaymentScreen.clickNumpad("."),
                PaymentScreen.remainingIs("15.70"),
                PaymentScreen.clickNumpad("6 7"),
                PaymentScreen.fillPaymentLineAmountMobile("Bank", "0.67"),
                PaymentScreen.remainingIs("15.03"),
                PaymentScreen.clickPaymentMethod("Cash", true, { remaining: "0.0" }),

                PaymentScreen.clickInvoiceButton(),
                PaymentScreen.clickValidate(),

                ReceiptScreen.receiptAmountTotalIs("15.72"),
                ReceiptScreen.receiptRoundingAmountIsNotThere(),
                ReceiptScreen.receiptToPayAmountIsNotThere(),
                ReceiptScreen.receiptChangeAmountIsNotThere(),
                ReceiptScreen.clickNextOrder(),
            ].flat(),
    });

registry
    .category("web_tour.tours")
    .add("test_cash_rounding_add_invoice_line_only_round_cash_method", {
        steps: () =>
            [
                Chrome.startPoS(),
                Dialog.confirm("Open Register"),

                // First order.
                ProductScreen.addOrderline("random_product", "1"),
                ProductScreen.clickPartnerButton(),
                ProductScreen.clickCustomer("partner_a"),
                ProductScreen.clickPayButton(),

                PaymentScreen.totalIs("15.72"),
                PaymentScreen.clickPaymentMethod("Cash", true, { remaining: "0.0" }),

                PaymentScreen.clickInvoiceButton(),
                PaymentScreen.clickValidate(),

                ReceiptScreen.receiptAmountTotalIs("15.72"),
                ReceiptScreen.receiptRoundingAmountIs("-0.02"),
                ReceiptScreen.receiptToPayAmountIs("15.70"),
                ReceiptScreen.receiptChangeAmountIsNotThere(),
                ReceiptScreen.clickNextOrder(),

                // Second order.
                ProductScreen.addOrderline("random_product", "1"),
                ProductScreen.clickPartnerButton(),
                ProductScreen.clickCustomer("partner_a"),
                ProductScreen.clickPayButton(),

                PaymentScreen.totalIs("15.72"),
                PaymentScreen.clickPaymentMethod("Bank"),
                PaymentScreen.clickNumpad("."),
                PaymentScreen.remainingIs("15.72"),
                PaymentScreen.clickNumpad("6 8"),
                PaymentScreen.fillPaymentLineAmountMobile("Bank", "0.68"),
                PaymentScreen.remainingIs("15.04"),
                PaymentScreen.clickPaymentMethod("Cash", true, { remaining: "0.0" }),

                PaymentScreen.clickInvoiceButton(),
                PaymentScreen.clickValidate(),

                ReceiptScreen.receiptAmountTotalIs("15.72"),
                ReceiptScreen.receiptRoundingAmountIs("0.01"),
                ReceiptScreen.receiptToPayAmountIs("15.73"),
                ReceiptScreen.receiptChangeAmountIsNotThere(),
                ReceiptScreen.clickNextOrder(),
            ].flat(),
    });

registry
    .category("web_tour.tours")
    .add("test_cash_rounding_biggest_tax_not_only_round_cash_method", {
        steps: () =>
            [
                Chrome.startPoS(),
                Dialog.confirm("Open Register"),

                // First order.
                ProductScreen.addOrderline("random_product", "1"),
                ProductScreen.clickPartnerButton(),
                ProductScreen.clickCustomer("partner_a"),
                ProductScreen.clickPayButton(),

                PaymentScreen.totalIs("15.70"),
                PaymentScreen.clickPaymentMethod("Cash", true, { remaining: "0.0" }),

                PaymentScreen.clickInvoiceButton(),
                PaymentScreen.clickValidate(),

                ReceiptScreen.receiptAmountTotalIs("15.70"),
                ReceiptScreen.receiptToPayAmountIsNotThere(),
                ReceiptScreen.receiptChangeAmountIsNotThere(),
                ReceiptScreen.clickNextOrder(),

                // Second order.
                ProductScreen.addOrderline("random_product", "1"),
                ProductScreen.clickPartnerButton(),
                ProductScreen.clickCustomer("partner_a"),
                ProductScreen.clickPayButton(),

                PaymentScreen.totalIs("15.70"),
                PaymentScreen.clickPaymentMethod("Bank"),
                PaymentScreen.clickNumpad("."),
                PaymentScreen.remainingIs("15.70"),
                PaymentScreen.clickNumpad("6 7"),
                PaymentScreen.fillPaymentLineAmountMobile("Bank", "0.67"),
                PaymentScreen.remainingIs("15.03"),
                PaymentScreen.clickPaymentMethod("Cash", true, { remaining: "0.0" }),

                PaymentScreen.clickInvoiceButton(),
                PaymentScreen.clickValidate(),

                ReceiptScreen.receiptAmountTotalIs("15.70"),
                ReceiptScreen.receiptRoundingAmountIs("0.02"),
                ReceiptScreen.receiptToPayAmountIs("15.72"),
                ReceiptScreen.receiptChangeAmountIsNotThere(),
                ReceiptScreen.clickNextOrder(),
            ].flat(),
    });

registry.category("web_tour.tours").add("test_cash_rounding_biggest_tax_only_round_cash_method", {
    steps: () =>
        [
            Chrome.startPoS(),
            Dialog.confirm("Open Register"),

            // First order.
            ProductScreen.addOrderline("random_product", "1"),
            ProductScreen.clickPartnerButton(),
            ProductScreen.clickCustomer("partner_a"),
            ProductScreen.clickPayButton(),

            PaymentScreen.totalIs("15.72"),
            PaymentScreen.clickPaymentMethod("Cash", true, { remaining: "0.0" }),

            PaymentScreen.clickInvoiceButton(),
            PaymentScreen.clickValidate(),

            ReceiptScreen.receiptAmountTotalIs("15.72"),
            ReceiptScreen.receiptRoundingAmountIs("-0.02"),
            ReceiptScreen.receiptToPayAmountIs("15.70"),
            ReceiptScreen.receiptChangeAmountIsNotThere(),
            ReceiptScreen.clickNextOrder(),

            // Second order.
            ProductScreen.addOrderline("random_product", "1"),
            ProductScreen.clickPartnerButton(),
            ProductScreen.clickCustomer("partner_a"),
            ProductScreen.clickPayButton(),

            PaymentScreen.totalIs("15.72"),
            PaymentScreen.clickPaymentMethod("Bank"),
            PaymentScreen.clickNumpad("."),
            PaymentScreen.remainingIs("15.72"),
            PaymentScreen.clickNumpad("6 8"),
            PaymentScreen.fillPaymentLineAmountMobile("Bank", "0.68"),
            PaymentScreen.remainingIs("15.04"),
            PaymentScreen.clickPaymentMethod("Cash", true, { remaining: "0.0" }),

            PaymentScreen.clickInvoiceButton(),
            PaymentScreen.clickValidate(),

            ReceiptScreen.receiptAmountTotalIs("15.72"),
            ReceiptScreen.receiptRoundingAmountIs("0.01"),
            ReceiptScreen.receiptToPayAmountIs("15.73"),
            ReceiptScreen.receiptChangeAmountIsNotThere(),
            ReceiptScreen.clickNextOrder(),
        ].flat(),
});
