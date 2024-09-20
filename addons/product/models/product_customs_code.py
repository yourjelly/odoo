# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class ProductCustomsCode(models.Model):
    _name = "product.customs_code"
    _description = "Codes used by customs authorities."

    _order = 'code, id'
    _rec_names_search = ['code', 'description']

    active = fields.Boolean(default=True)
    code = fields.Char(string='Code', required=True)
    code_type = fields.Selection(
        selection=[]
    )
    res_model = fields.Char('Model', readonly=True)
    description = fields.Char(string='Description', translate=True)

    start_date = fields.Date(
        string='Usage start date',
        help='Date from which a code may be used.',
    )
    expiry_date = fields.Date(
        string='Expiry Date',
        help='Date at which a code must not be used anymore.',
    )

    @api.depends('code')
    def _compute_display_name(self):
        """ Display. """
        for code in self:
            code.display_name = f"{code.code}: {code.description}"
