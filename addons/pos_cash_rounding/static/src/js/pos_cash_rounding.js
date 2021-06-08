odoo.define('pos_cash_rounding.cash_rounding', function (require) {
    "use strict";

var models = require('point_of_sale.models');
var rpc = require('web.rpc');
var screens = require('point_of_sale.screens');
var utils = require('web.utils');

var round_pr = utils.round_precision;


models.load_models([{
    model: 'account.cash.rounding',
    fields: ['name', 'rounding', 'rounding_method'],
    domain: function(self){return [['id', '=', self.config.rounding_method[0]]]; },
    loaded: function(self, cash_rounding) {
        self.cash_rounding = cash_rounding;
    }
},
]);

var _super_order = models.Order.prototype;
models.Order = models.Order.extend({
    export_for_printing: function() {
      var result = _super_order.export_for_printing.apply(this,arguments);
      result.total_rounded = this.get_total_with_tax() + this.get_rounding_applied();
      result.rounding_applied = this.get_rounding_applied();
      return result;
    },
    get_due: function(paymentline) {
      var due  = _super_order.get_due.apply(this, arguments);
      due += this.get_rounding_applied();
      return round_pr(due, this.pos.currency.rounding);
    },
    get_change_value: function(paymentline) {
      var change  = _super_order.get_change_value.apply(this, arguments);
      change -= this.get_rounding_applied();
      return round_pr(change, this.pos.currency.rounding);
    },
    get_rounding_applied: function() {
        if(this.pos.config.cash_rounding) {
            const only_cash = this.pos.config.only_round_cash_method;
            const paymentlines = this.get_paymentlines();
            const last_line = paymentlines ? paymentlines[paymentlines.length-1]: false;
            const last_line_is_cash = last_line ? last_line.cashregister.journal.type === "cash": false;
            if (!only_cash || (only_cash && last_line_is_cash)) {
                var remaining = this.get_total_with_tax() - this.get_total_paid();
                var total = round_pr(remaining, this.pos.cash_rounding[0].rounding);
                var sign = remaining > 0 ? 1.0 : -1.0;

                var rounding_applied = total - remaining;
                rounding_applied *= sign;
                // because floor and ceil doesn't include decimals in calculation, we reuse the value of the half-up and adapt it.
                if (utils.float_is_zero(rounding_applied, this.pos.currency.decimals)){
                    // https://xkcd.com/217/
                    return 0;
                } else if(this.pos.cash_rounding[0].rounding_method === "UP" && rounding_applied < 0 && remaining > 0) {
                    rounding_applied += this.pos.cash_rounding[0].rounding;
                } else if(this.pos.cash_rounding[0].rounding_method === "UP" && rounding_applied > 0 && remaining < 0) {
                    rounding_applied -= this.pos.cash_rounding[0].rounding;
                }  else if(this.pos.cash_rounding[0].rounding_method === "DOWN" && rounding_applied > 0 && remaining > 0){
                    rounding_applied -= this.pos.cash_rounding[0].rounding;
                } else if(this.pos.cash_rounding[0].rounding_method === "DOWN" && rounding_applied < 0 && remaining < 0){
                    rounding_applied += this.pos.cash_rounding[0].rounding;
                }
                return sign * rounding_applied;
            } else {
                return 0;
            }
        }
        return 0;
    },
    check_paymentlines_rounding: function() {
        if(this.pos.config.cash_rounding) {
            var cash_rounding = this.pos.cash_rounding[0].rounding;
            var default_rounding = this.pos.currency.rounding;
            for(var id in this.get_paymentlines()) {
                var line = this.get_paymentlines()[id];
                var diff = round_pr(round_pr(line.amount, cash_rounding) - round_pr(line.amount, default_rounding), default_rounding);
                if(diff && line.cashregister.journal.type === "cash") {
                    return false;
                } else if(!this.pos.config.only_round_cash_method && diff) {
                    return false;
                }
            }
            return true;
        }
        return true;
    },
    is_paid: function() {
        var is_paid = _super_order.is_paid.apply(this, arguments);
        return is_paid && this.check_paymentlines_rounding();
    }
});
});
