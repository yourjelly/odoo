# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models

class ResPartner(models.Model):
    _inherit = 'res.partner'

    def _duplicate_field_need_variation(self, field, **kwargs):
        # we force the variation of the name of the partner,
        # because a company name has an unique constraints on the name,
        # which is a related store field to the partner's name,
        # but we don't know when duplicating the res.partner
        if field.name == 'name':
            return True
        return super()._duplicate_field_need_variation(field, **kwargs)
