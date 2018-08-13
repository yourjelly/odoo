# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class ResPartner(models.Model):
    _inherit = 'res.partner'

    # Use in view attrs. Need to required state_id if Country is India.
    country_code = fields.Char(related="country_id.code", string="Country code")
    # In GSTR-2 report We need to specify that vendor is under composition scheme or not.
    l10n_in_composition = fields.Boolean(string="Is Composition", help="Check this box if this vendor is under composition scheme")

    @api.multi
    def name_get(self):
        res = super(ResPartner, self).name_get()
        if not self._context.get('show_vat'):
            return res
        new_res = []
        for partner in res:
            name = partner[1]
            vat = self.browse(partner[0]).vat
            if vat:
                name = "%s (%s)" % (name, vat)
            new_res.append((partner[0], name))
        return new_res

    @api.constrains('vat', 'country_id')
    def l10n_in_check_vat(self):
        for partner in self.filtered(lambda p: p.commercial_partner_id.country_id.code == 'IN' and p.vat and len(p.vat) != 15):
            raise ValidationError(_('The GSTIN [%s] for partner [%s] should be 15 characters only.') % (partner.vat, partner.name))
