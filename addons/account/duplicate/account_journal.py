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

    def _duplicate_force_factor(self, curr_factor, **kwargs):
        # the `code` field has a short size that needs to be unique
        # therefor we can't have more than [a-zA-Z0-9] ** size different journals.
        curr_tbl_size = self.search_count([])
        char_cardinality = 26 * 2 + 10  # number of diff chars in [a-zA-Z0-9]
        max_size = char_cardinality ** self._fields['code'].size
        if curr_tbl_size * curr_factor > max_size:
            return max_size // curr_tbl_size
        return super()._duplicate_force_factor(curr_factor, **kwargs)
