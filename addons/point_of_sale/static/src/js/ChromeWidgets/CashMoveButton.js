odoo.define('point_of_sale.CashMoveButton', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    const { _t } = require('web.core');
    const { renderToString } = require('@web/core/utils/render');

    const TRANSLATED_CASH_MOVE_TYPE = {
        in: _t('in'),
        out: _t('out'),
    };

    class CashMoveButton extends PosComponent {
        static props = {
            sessionId: { type: Number },
            printer: { type: Object, optional: true },
            cashier: { type: Object, optional: true }, // mandatory if there's printer
            company: { type: Object, optional: true }, // mandatory if there's printer
        }
        async onClick() {
            const { confirmed, payload } = await this.showPopup('CashMovePopup');
            if (!confirmed) return;
            const { type, amount, reason } = payload;
            const translatedType = TRANSLATED_CASH_MOVE_TYPE[type];
            const formattedAmount = this.env.pos.format_currency(amount);
            if (!amount) {
                return this.showNotification(
                    _.str.sprintf(this.env._t('Cash in/out of %s is ignored.'), formattedAmount),
                    3000
                );
            }
            const extras = { formattedAmount, translatedType };
            await this.rpc({
                model: 'pos.session',
                method: 'try_cash_in_out',
                args: [[this.props.sessionId], type, amount, reason, extras],
            });
            if (this.props.printer) {
                const renderedReceipt = renderToString('point_of_sale.CashMoveReceipt', {
                    _receipt: this._getReceiptInfo({ ...payload, translatedType, formattedAmount }),
                });
                const printResult = await this.props.printer.print_receipt(renderedReceipt);
                if (!printResult.successful) {
                    this.showPopup('ErrorPopup', { title: printResult.message.title, body: printResult.message.body });
                }
            }
            this.showNotification(
                _.str.sprintf(this.env._t('Successfully made a cash %s of %s.'), type, formattedAmount),
                3000
            );
        }
        _getReceiptInfo(payload) {
            const result = { ...payload };
            result.cashier = this.props.cashier;
            result.company = this.props.company;
            return result;
        }
    }
    CashMoveButton.template = 'point_of_sale.CashMoveButton';

    Registries.Component.add(CashMoveButton);

    return CashMoveButton;
});
