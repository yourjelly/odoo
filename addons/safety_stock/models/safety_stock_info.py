from odoo import models, api, fields


class StockReplenishmentInfo(models.TransientModel):

    _name = 'safety.stock.info'

    orderpoint_id = fields.Many2one('stock.warehouse.orderpoint')
    product_id = fields.Many2one('product.product', related='orderpoint_id.product_id')

    mean_sales = fields.Float(related='orderpoint_id.mean_sales')
    variance_sales = fields.Float(related='orderpoint_id.variance_sales')
    mean_lead_time = fields.Float(related='orderpoint_id.mean_lead_time')
    variance_lead_time = fields.Float(related='orderpoint_id.variance_lead_time')
    max_sales = fields.Integer(related='orderpoint_id.max_sales')
    max_lead_time = fields.Integer(related='orderpoint_id.max_lead_time')

    Z = fields.Float(required=True, default=0.5, string="Z (Factor Service)")

    SS1 = fields.Integer(compute="_compute_ss1", string="SS1 = μsales × t =")
    SS2 = fields.Integer(compute="_compute_ss2", string="SS2 = (max(μLT)×max(sales))−(μLT ×μsales) =")
    SS3 = fields.Float(compute="_compute_ss3", string="SS3 = Z × σsales × sqrt(μLT) =")
    SS4 = fields.Float(compute="_compute_ss4", string="SS4 = Z × μsales × σLT =")
    SS5 = fields.Float(compute="_compute_ss5", string="SS5 = Z × sqrt(μLT × σsales^2 + μsales^2 × σLT^2) =")
    SS6 = fields.Float(compute="_compute_ss6", string="SS6 = Z × (σsales × μLT + μsales × σLT) =")

    @api.depends('mean_sales')
    def _compute_ss1(self):
        for record in self:
            record.SS1 = record.mean_sales * 30

    @api.depends('mean_sales', 'mean_lead_time', 'max_sales', 'max_lead_time')
    def _compute_ss2(self):
        for record in self:
            record.SS2 = (record.max_lead_time * record.max_sales) - (record.mean_lead_time * record.mean_sales)

    @api.depends('variance_sales', 'Z', 'mean_lead_time')
    def _compute_ss3(self):
        for record in self:
            record.SS3 = record.Z * pow(record.variance_sales, 0.5) * pow(record.mean_lead_time, 0.5)

    @api.depends('mean_sales', 'Z', 'variance_lead_time')
    def _compute_ss4(self):
        for record in self:
            record.SS4 = record.Z * record.mean_sales * pow(record.variance_lead_time, 0.5)

    @api.depends('mean_sales', 'variance_lead_time', 'variance_sales', 'Z', 'mean_lead_time')
    def _compute_ss5(self):
        for record in self:
            record.SS5 = record.Z * pow((record.mean_lead_time * record.variance_sales) +
                                        (pow(record.max_sales, 2) * record.variance_lead_time), 0.5)

    @api.depends('mean_sales', 'variance_lead_time', 'variance_sales', 'Z', 'mean_lead_time')
    def _compute_ss6(self):
        for record in self:
            record.SS6 = record.Z * (pow(record.variance_sales, 0.5) * pow(record.mean_lead_time, 0.5)
                                     + record.mean_sales * pow(record.variance_lead_time, 0.5))
