# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError
from odoo.osv import expression


class HrDepartureReason(models.Model):
    _description = "Departure Reason"
    _order = "sequence"
    _parent_name = "parent_id"

    sequence = fields.Integer("Sequence", default=10)
    name = fields.Char(string="Reason", required=True, translate=True)
#     reason_code = fields.Integer()
    country_code = fields.Char("Country", default=lambda self: self.env.company.country_code)

    parent_id = fields.Many2one("hr.departure.reason", string="Parent Country-Generic Reason", domain=[('country_code', '=', False)])
    child_ids = fields.One2many('hr.departure.reason', 'parent_id', string="Country-Specific Overrides")
    
    @api.model
    def _country_domain(self, country_codes):
        if not country_codes.__iter__:
            country_codes = [country_codes]
        return [
            '|',
                ('country_code', 'in', country_codes),
                '&',
                    ('country_code', '=', False),
                    # find only country-generic reasons for which a relevant country-specific reason is not found
                    *expression.OR([
                        [('child_ids', 'not any', [('country_code', '=', code)])]
                        for code in country_codes])
        ]

    def _get_default_departure_reasons(self):
        return {self.env.ref(reason_ref) for reason_ref in (
            'hr.departure_fired',
            'hr.departure_resigned',
            'hr.departure_retired',
        )}

    @api.ondelete(at_uninstall=False)
    def _unlink_except_default_departure_reasons(self):
        master_departure_codes = self._get_default_departure_reasons()
        if any(reason in master_departure_codes for reason in self):
            raise UserError(_('Default departure reasons cannot be deleted.'))

    # We want 2 "types" of departure reasons: country-generic or country-specific
    # country-specific reasons may have a country-generic parent -- all other parent-child relation are forbidden
    # (consequence: the hierarchy has 2 levels max)
    @api.constrains('parent_id', 'country_code')
    def _parent_is_country_generic(self):
        if any(self.parent_id.mapped('country_code')):
            raise ValidationError(_("A departure reason's parent must be country-generic"))
        if any(reason.parent_id and not reason.country_code for reason in self):
            raise ValidationError(_("A country-generic departure reason may not have a parent"))


