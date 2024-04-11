# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models
from odoo.tools import format_amount


class PaymentLinkWizard(models.TransientModel):
    _inherit = ['payment.link.wizard']
    _description = 'Generate Sales Payment Link'

    amount_paid = fields.Monetary(string="Already Paid", readonly=True)
    confirmation_message = fields.Char(compute='_compute_confirmation_message')

    @api.depends('amount')
    def _compute_confirmation_message(self):
        self.confirmation_message = False
        for wizard in self.filtered(lambda w: w.res_model == 'sale.order'):
            sale_order = wizard.env['sale.order'].sudo().browse(wizard.res_id)
            if sale_order.state in ('draft', 'sent') and sale_order.require_payment:
                remaining_amount = sale_order._get_prepayment_required_amount() - sale_order.amount_paid
                if wizard.currency_id.compare_amounts(wizard.amount, remaining_amount) >= 0:
                    wizard.confirmation_message = _("This payment will confirm the quotation.")
                else:
                    wizard.confirmation_message = _(
                        "Customer needs to pay at least %(amount)s to confirm the order.",
                        amount=format_amount(wizard.env, remaining_amount, wizard.currency_id),
                    )

    def _prepare_query_params(self, *args):
        """ Override of `payment` to add SO related values to the query params. """
        res = super()._prepare_query_params(*args)
        if self.res_model != 'sale.order':
            return res

        sale_order = self.env['sale.order'].browse(self.res_id)
        # The other order-related values are read directly from the sales order in the controller.
        return {
            'link_amount': self.amount,
            'access_token': sale_order._portal_ensure_token(),
            'showPaymentModal': 'true',
        }

    def _prepare_url(self, base_url, related_document):
        if self.res_model == 'sale.order':
            return f'{base_url}/my/orders/{related_document.id}'

        return super()._prepare_url(base_url, related_document)
