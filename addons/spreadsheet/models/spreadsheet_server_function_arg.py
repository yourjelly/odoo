# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api,fields, models


class SpreadsheetServerFunctionArg(models.Model):
    _name = "spreadsheet.server.function.arg"
    _order = "sequence"

    name = fields.Char(required=True)
    sequence = fields.Integer(required=True)
    function_id = fields.Many2one('spreadsheet.server.function', required=True)
    description = fields.Text(translate=True)
    type = fields.Selection([
        ('string', 'String'),
        ('number', 'Number'),
        ('integer', 'Integer'),
        ('boolean', 'Boolean'),
        # ('date', 'Date'),
        # ('datetime', 'Datetime'),
        # ('time', 'Time'),
    ], default='string', required=True)
