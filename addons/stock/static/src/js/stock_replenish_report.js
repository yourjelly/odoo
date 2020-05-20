odoo.define('stock.ReplenishReport', function (require) {
"use strict";

const clientAction = require('report.client_action');
const core = require('web.core');
const session = require('web.session');

const qweb = core.qweb;
const _t = core._t;


const ReplenishReport = clientAction.extend({
    /**
     * @override
     */
    init: function (parent, action, options) {
        this._super.apply(this, arguments);
        this.productId = action.context.active_id;
        this.resModel = action.context.active_model;
        const reportName = this.resModel === 'product.template' ? 'report_product_template_replenishment' : 'report_product_product_replenishment';

        this.report_url = `/report/html/stock.${reportName}/${this.productId}`;
        this._title = action.name;
    },

    /**
     * @override
     */
    start: function () {
        return Promise.all([this._super(...arguments), session.is_bound]).then(() => {
            const $newButtons = $(qweb.render('replenish_report_buttons', {}));
            this.$buttons.find('.o_report_print').replaceWith($newButtons);
            this.$buttons.on('click', '.o_report_replenish_buy', this._onClickReplenish.bind(this));
            this.controlPanelProps.cp_content = {
                $buttons: this.$buttons,
            };
        });
    },

    /**
     * Opens the product replenish wizard. Could re-open the report if pending
     * forecasted quantities need to be updated.
     *
     * @returns {Promise}
     */
    _onClickReplenish: function () {
        const context = Object.assign({}, this.context);
        if (this.resModel === 'product.product') {
            context.default_product_id = this.productId;
        } else if (this.resModel === 'product.template') {
            context.default_product_tmpl_id = this.productId;
        }

        const on_close = function (res) {
            if (res && res.special) {
                // Do nothing when the wizard is discarded.
                return;
            }
            // Otherwise, opens again the report.
            return this._rpc({
                model: this.resModel,
                method: 'action_open_forecasted_report',
                args: [this.productId],
                context: this.context,
            }).then((action) => {
                const context = {
                    active_id: this.productId,
                    active_model: this.resModel,
                };
                action.context = context;
                return this.do_action(action);
            });
        };

        const action = {
            res_model: 'product.replenish',
            name: _t('Product Replenish'),
            type: 'ir.actions.act_window',
            views: [[false, 'form']],
            target: 'new',
            context: _.extend(this.context, context),
        };

        return this.do_action(action, {
            on_close: on_close.bind(this),
        });
    },
});

core.action_registry.add('replenish_report', ReplenishReport);

});
