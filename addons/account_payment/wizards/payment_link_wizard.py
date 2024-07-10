# Part of Odoo. See LICENSE file for full copyright and licensing details.

from werkzeug import urls

from odoo import _, api, fields, models
from odoo.addons.payment import utils as payment_utils
from odoo.tools import format_date, formatLang


class PaymentLinkWizard(models.TransientModel):
    _inherit = 'payment.link.wizard'

    open_installments = fields.Binary(export_string_translation=False)
    open_installments_preview = fields.Html(
        export_string_translation=False, compute='_compute_open_installments_preview'
    )

    @api.depends('open_installments')
    def _compute_open_installments_preview(self):
        for wizard in self:
            preview = ""
            for installment in wizard.open_installments:
                preview += "<div>"
                preview += _(
                    '#%(number)s - Installment of <strong>%(amount)s</strong> due on <strong class="text-primary">%(date)s</strong>',
                    number=installment['number'],
                    amount=formatLang(
                        self.env, installment['amount_residual'], monetary=True, currency_obj=wizard.currency_id
                    ),
                    date=format_date(self.env, installment['date']),
                )
                preview += "</div>"
            wizard.open_installments_preview = preview

    def _get_additional_link_values(self):
        """ Override of `payment` to add `invoice_id` to the payment link values.

        The other values related to the invoice are directly read from the invoice.

        Note: self.ensure_one()

        :return: The additional payment link values.
        :rtype: dict
        """
        res = super()._get_additional_link_values()
        if self.res_model != 'account.move':
            return res

        # Invoice-related fields are retrieved in the controller.
        return {
            'invoice_id': self.res_id,
        }

    def _compute_link(self):
        # EXTENDS payment
        for payment_link in self:
            if payment_link.res_model != 'account.move':
                super()._compute_link()
                return

            # Make sure people don't tamper with the amount or move of the payment link
            payment_token = payment_utils.generate_access_token(payment_link.res_id, payment_link.amount)
            move = self.env[payment_link.res_model].browse(payment_link.res_id)
            base_url = move.get_base_url()
            url_params = {
                'payment': True,
                'move_id': move.id,
                'amount': payment_link.amount,
                'payment_token': payment_token,
            }
            payment_link.link = base_url + move.get_portal_url(
                anchor='portal_pay',
                query_string=f'&{urls.url_encode(url_params)}'
            )
