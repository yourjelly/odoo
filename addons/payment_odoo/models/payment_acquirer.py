# Part of Odoo. See LICENSE file for full copyright and licensing details.

from werkzeug import urls

from odoo import api, fields, models
from odoo.exceptions import ValidationError


class PaymentAcquirer(models.Model):
    _inherit = 'payment.acquirer'

    provider = fields.Selection(
        selection_add=[('odoo', "Odoo Payments")], ondelete={'odoo': 'set default'})
    odoo_adyen_account_id = fields.Many2one(
        related='company_id.adyen_account_id', required_if_provider='odoo')

    @api.constrains('state')
    def _check_adyen_account_state(self):
        for acquirer in self.filtered(lambda acq: acq.provider == 'odoo'):
            adyen_account = acquirer.odoo_adyen_account_id
            if acquirer.state == 'enabled':
                if adyen_account.is_test:
                    raise ValidationError("You cannot enable the acquirer with a test account")
                elif not adyen_account.account_status == 'active':
                    raise ValidationError("You cannot enable the acquirer with a disabled account")
            elif acquirer.state == 'test':
                if not adyen_account.is_test:
                    raise ValidationError("You cannot make test payments with a live account")
                elif not adyen_account.account_status == 'active':
                    raise ValidationError("You cannot make payments with a disabled account")

    def odoo_create_adyen_account(self):
        return self.env['adyen.account'].action_create_redirect()

    def _odoo_get_api_url(self):
        self.ensure_one()
        proxy_url = self.env['ir.config_parameter'].sudo().get_param('adyen_platforms.proxy_url')
        return urls.url_join(proxy_url, 'v1/pay_by_link')

    def _odoo_compute_shopper_reference(self, partner_id):
        """ Compute a unique reference of the partner for Adyen.

        This is used for the `shopperReference` field in communications with Adyen.

        :param int partner_id: The partner making the transaction, as a `res.partner` id
        :return: The unique reference for the partner
        :rtype: str
        """
        return f'{self.odoo_adyen_account_id.adyen_uuid}_{partner_id}'

    def _get_default_payment_method_id(self):
        self.ensure_one()
        if self.provider != 'odoo':
            return super()._get_default_payment_method_id()
        return self.env.ref('payment_odoo.payment_method_odoo').id
