from odoo import fields, models


class TsForecastParameter(models.Model):
    _name = 'ts.forecast.parameter'
    _description = 'parameter value of a forecast model'

    value = fields.Float()
