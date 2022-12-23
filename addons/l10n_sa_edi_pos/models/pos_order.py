from odoo import models, fields, api, _


class PosOrder(models.Model):
    _inherit = "pos.order"

    def _prepare_invoice_vals(self):
        """
            Override to set the value of the adjustment reason to POS Refund
        """
        res = super(PosOrder, self)._prepare_invoice_vals()
        if self.amount_total < 0:
            res['l10n_sa_adjustment_reason'] = _("POS Refund")
        return res
