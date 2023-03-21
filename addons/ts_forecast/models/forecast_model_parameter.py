from odoo import fields, models


class TsForecastParameter(models.Model):
    _name = 'ts.forecast.parameter'

    value = fields.Float()
