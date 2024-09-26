from odoo import models


class QRISTransaction(models.Model):
    _inherit = "l10n_id.qris.transaction"

    def _get_supported_models(self):
        return super()._get_supported_models() + ['sale.order']

    def _get_record(self):
        # Override
        # add it for sale.order
        if self.model == 'sale.order':
            return self.env[self.model].search([('uuid', '=', self.model_id)])
        return super()._get_record()
