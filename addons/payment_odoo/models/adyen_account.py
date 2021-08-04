# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
from odoo import api, models

_logger = logging.getLogger(__name__)


class AdyenAccount(models.Model):
    _inherit = 'adyen.account'

    @api.model
    def create(self, values):
        account = super().create(values)

        # searching on adyen_account_id doesn't work
        # to investigate if we have time
        # or use direct ref ???
        acqs = self.env['payment.acquirer'].search([
            ('provider', '=', 'odoo'),
            ('company_id', '=', self.env.company.id)
        ])
        if not acqs:
            _logger.warning(
                "Couldn't enable Odoo Payments since the acquirer wasn't found.")
        # FIXME ANVFE: there is no journal on the acquirer by default, how to ensure we have one ?
        # NOTE: the journal_id requirement is only imposed through the acquirer view,
        # not through python code.
        acqs.state = 'test'
        return account

    def unlink(self):
        acquirer = self.env['payment.acquirer'].search([
            ('provider', '=', 'odoo'),
            ('odoo_adyen_account_id', 'in', self.ids)])
        acquirer.state = 'disabled'
        return super().unlink()
