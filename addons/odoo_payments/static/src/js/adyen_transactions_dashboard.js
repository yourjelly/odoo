odoo.define('odoo_payments.transactions.dashboard', require => {
    "use strict";

    const ListRenderer = require('web.ListRenderer');
    const ListView = require('web.ListView');

    const viewRegistry = require('web.view_registry');

    const core = require('web.core');
    const QWeb = core.qweb;

    const AdyenTransactionsListRenderer = ListRenderer.extend({

        /**
         * TODO ANVFE
         *
         * @return {*}
         * @private
         */
        _render: function () {
            const el = this.$el.parent();
            return this._super.apply(this, arguments).then(() => {
                this._rpc({
                    model: 'adyen.account.balance',
                    method: 'get_account_balance',
                    content: this.context
                }).then((result) => {
                    el.parent().find('.o_adyen_transactions_dashboard').remove();

                    const dash = QWeb.render('AdyenTransactions.dashboard', { 
                        balances: result,
                    });
                    el.before(dash);
                });
            });
        }
    });

    const AdyenTransactionsListView = ListView.extend({
        config: _.extend({}, ListView.prototype.config, {
            Renderer: AdyenTransactionsListRenderer
        }),
    });

    viewRegistry.add('adyen_transactions_list', AdyenTransactionsListView);
});
