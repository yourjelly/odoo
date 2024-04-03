# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    l10n_it_use_declaration_of_intent = fields.Boolean(
        string='Use Declaration of Intent',
        default=False,
    )

    l10n_it_declaration_of_intent_ids = fields.One2many(
        'l10n_it.declaration_of_intent',
        'partner_id',
        string="Available Declarations of Intent of this partner",
        domain=lambda self: [('company_id', '=', self.env.company.id)],
    )
