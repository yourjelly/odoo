# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models

HS_SECTION = [
    ('I', 'I'),
    ('II', 'II'),
    ('III', 'III'),
    ('IV', 'IV'),
    ('V', 'V'),
    ('VI', 'VI'),
    ('VII', 'VII'),
    ('VIII', 'VIII'),
    ('IX', 'IX'),
    ('X', 'X'),
    ('XI', 'XI'),
    ('XII', 'XII'),
    ('XIII', 'XIII'),
    ('XIV', 'XIV'),
    ('XV', 'XV'),
    ('XVI', 'XVI'),
    ('XVII', 'XVII'),
    ('XVIII', 'XVIII'),
    ('XIX', 'XIX'),
    ('XX', 'XX'),
    ('XXI', 'XXI'),
    ('TOTAL', 'TOTAL'),
]


class ProductCustomsCode(models.Model):
    _inherit = "product.customs_code"

    code_type = fields.Selection(selection_add=[('hs', 'Harmonized System (HS)')])
    hs_section = fields.Selection(HS_SECTION)
    hs_level = fields.Integer()
