# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.tools.sql import SQL

class AccountJournal(models.Model):
    _inherit = 'account.journal'

    def _duplicate_variate_field(self, field, **kwargs):
        if field.name == 'code':
            # the code has a short length, we can't just append the series,
            # so we fall back to a random string of said length
            # size = 5 -> max count of journals are 16**5 = ~1M
            # TODO: find an alternative to the randomness
            return SQL('left(md5(random()::text), %s)', field.size)
        return super()._duplicate_variate_field(field, **kwargs)
