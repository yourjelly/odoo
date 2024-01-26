# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, fields


class TimesheetProduct(models.Model):
    _inherit = "product.template"

    service_type = fields.Selection(selection_add=[
        ('timesheet', 'Timesheets on project (one fare per SO/MO/Project)'),
    ], ondelete={'timesheet': 'set manual'})
