from odoo import api, fields, models


class AccountMoveHashIntegrityResultWizard(models.TransientModel):
    _name = 'account.move.hash.integrity.result.wizard'
    _description = 'Account Move Hash Integrity Result Wizard'

    def _get_hash_integrity_result(self):
        return self._context.get('hash_integrity_result')

    hash_integrity_result = fields.Html(readonly=True, default=_get_hash_integrity_result)
