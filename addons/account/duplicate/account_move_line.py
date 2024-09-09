from odoo import models

class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    def _duplicate_follow_related_store(self, field, **kwargs):
        if field.name == 'move_name':
            return True
        return super()._duplicate_follow_related_store(field)
