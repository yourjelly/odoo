# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models

class ResourceLeaveWizardMixin(models.AbstractModel):
    _name = 'resource.leave.wizard.mixin'
    _description = 'Resource Leave Creator for Managers'

    resource_ids = fields.Many2many(comodel_name='resource.resource',
        export_string_translation=False, required=True)

    # description
    name = fields.Char('Description')
    notes = fields.Text('Reasons', readonly=False)

    tz_mismatch = fields.Boolean(compute='_compute_tz_mismatch', export_string_translation=False)
    # These dates are computed based on request_date_{to,from} and should
    # therefore never be set directly.
    date_from = fields.Datetime(required=True, export_string_translation=False)
    date_to = fields.Datetime(required=True, export_string_translation=False)
