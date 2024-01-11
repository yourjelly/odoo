from odoo import models, fields, api


class AccountAnalyticLine(models.Model):
    _inherit = 'account.analytic.line'

    source_document_model = fields.Selection(selection_add=[('purchase.order.line', 'Purchase Order Line')], ondelete={'account.move.line': 'cascade'})
    purchase_line_id = fields.Many2oneReferenceField(
        string='Purchase Line',
        comodel_name='purchase.order.line',
        reference_field='source_document_id',
    )

    @api.depends('purchase_line_id.product_id')
    def _compute_product_id(self):
        super()._compute_product_id()
        for line in self.filtered('purchase_line_id'):
            line.product_id = line.purchase_line_id.product_id

    @api.depends('purchase_line_id')
    def _compute_category(self):
        super()._compute_category()
        for line in self.filtered(('purchase_line_id')):
            line.category = 'other'

    @api.depends('purchase_line_id.price_subtotal_to_invoice', 'percentage')
    def _compute_amount(self):
        super()._compute_amount()
        for line in self.filtered(('purchase_line_id')):
            line.amount = -line.purchase_line_id.price_subtotal_to_invoice * line.percentage

    @api.depends('purchase_line_id.name')
    def _compute_name(self):
        super()._compute_name()
        for line in self.filtered(('purchase_line_id')):
            line.name = line.purchase_line_id.name

    @api.depends('purchase_line_id.partner_id')
    def _compute_partner_id(self):
        super()._compute_partner_id()
        for line in self.filtered(('purchase_line_id')):
            line.partner_id = line.purchase_line_id.partner_id

    @api.depends('budget_id')
    def _compute_line_type(self):
        super()._compute_line_type()
        for line in self.filtered(('purchase_line_id')):
            line.line_type = '2_commited'
