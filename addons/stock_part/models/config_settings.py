from odoo import models, fields, api


class ConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"
    update_stock_quantities = fields.Selection(readonly=True,
                                               related="company_id.point_of_sale_update_stock_quantities")

    @api.model
    def get_values(self):
        res = super(ConfigSettings, self).get_values()
        res.update(update_stock_quantities='real')
        return res


class Company(models.Model):
    _inherit = 'res.company'
    point_of_sale_update_stock_quantities = fields.Selection(default='real')
