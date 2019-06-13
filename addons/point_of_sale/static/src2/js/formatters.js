odoo.define("point_of_sale.Formatters", function(require) {
    "use strict";

    const field_utils = require("web.field_utils");
    const { round_decimals } = require("web.utils");

    class Formatters {
        constructor(model) {
            this.model = model;
        }
        get currency() {
            const { currency } = this.model || Formatters.defaults;
            return currency;
        }
        formatCurrency(amount, precision) {
            const formatted = this.formatCurrencyNoSymbol(
                amount,
                precision,
                this.currency,
                this.model.dp
            );
            const { position, symbol = "" } = this.currency;
            if (position === "after") {
                return `${formatted} ${symbol}`;
            }
            return `${symbol} ${formatted}`;
        }

        formatCurrencyNoSymbol(amount, precision) {
            let { decimals } = this.currency;
            if (precision && this.model.dp[precision]) {
                decimals = this.model.dp[precision];
            }
            if (typeof amount !== "number") {
                return amount;
            }
            const fixedAmount = round_decimals(amount, decimals).toFixed(decimals);
            return field_utils.format.float(round_decimals(fixedAmount, decimals), {
                digits: [69, decimals],
            });
        }
    }

    Formatters.defaults = {
        currency: {
            symbol: "$",
            position: "after",
            rounding: 0.01,
            decimals: 2,
        },
    };

    return Formatters;
});
