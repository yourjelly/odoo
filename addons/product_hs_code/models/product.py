# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api
from odoo.osv import expression


class ProductTemplate(models.Model):
    _inherit = 'product.template'
    hs_code_id = fields.Many2one(
        comodel_name='product.customs_code',
        string='HS Code',
        domain="[('code_type', '=', 'hs')]",
        compute='_compute_hs_code_id',
        inverse='_set_hs_code_id',
    )

    @api.depends('product_variant_ids.hs_code_id')
    def _compute_hs_code_id(self):
        self._compute_template_field_from_variant_field('hs_code_id')

    def _set_hs_code_id(self):
        self._set_product_variant_field('hs_code_id')

    def _get_related_fields_variant_template(self):
        fields = super()._get_related_fields_variant_template()
        fields += ['hs_code_id']
        return fields


class ProductProduct(models.Model):
    _inherit = 'product.product'
    hs_code_id = fields.Many2one(
        'product.customs_code',
        'HS Code',
        domain="[('code_type', '=', 'hs')",
        help='The HS Code related to this product.'
    )
