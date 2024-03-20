# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ProjectMilestone(models.Model):
    _inherit = 'project.milestone'

    quantity_percentage = fields.Float('Quantity (%)', compute="_compute_quantity_percentage", store=True,
                                       help='Percentage of the demand quantity that will automatically be delivered once the milestone is reached.')
    product_uom = fields.Many2one('uom.uom', compute="_compute_product_uom")
    product_uom_qty = fields.Float("Quantity", compute="_compute_product_uom_qty", readonly=False)

    def _compute_quantity_percentage(self):
        self.quantity_percentage = 0  # To override

    def _compute_product_uom(self):
        self.product_uom = self.env['uom.uom']  # To override

    def _compute_product_uom_qty(self):
        self.product_uom_qty = 0  # To override

    @api.model
    def _get_fields_to_export(self):
        return super()._get_fields_to_export() + ['quantity_percentage']
