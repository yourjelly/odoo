from odoo import api, fields, models, _
from odoo.addons.base.models.res_partner import _tz_get
from odoo.exceptions import ValidationError


# This model's only purpose is to gather dates from all individual leaves across the
# different models to make it more easy to retrieve leave_intervals etc.
class ResourceResourceLeave(models.Model):
    _name = "resource.resource.leave"
    _description = "Resource Resource Leave"
    _order = "date_from"

    active = fields.Boolean(default=True)
    date_from = fields.Datetime(string='Start Date', required=True)
    date_to = fields.Datetime(string='End Date', required=True,
        compute='_compute_date_to', readonly=False, store=True)
    resource_id = fields.Many2one(comodel_name='resource.resource', string='Resource', index=True, required=True)
    time_type = fields.Selection(
        selection=[
            ('leave', 'Time Off'),
            ('other', 'Other')],
        default='leave')
    tz = fields.Selection(selection=_tz_get)

    _sql_constraints = [
        ('date_check', "CHECK(date_from <= date_to)", "The start date must be anterior to the end date."),
    ]

    @api.constrains('date_from', 'date_to', 'active', 'resource_id')
    def check_no_overlap(self):
        overlapping_leaves = self.search([
            ('active', '=', True),
            ('resource_id', 'in', self.resource_id.ids),
            ('date_from', '<', max(self.mapped('date_to'))),
            ('date_to', '>', min(self.mapped('date_from'))),
        ])
        for leave in self:
            if not leave.active:
                continue
            for overlap in overlapping_leaves:
                if overlap.resource_id == leave.resource_id or overlap.id == leave.id:
                    continue
                if overlap.date_from < leave.date_to and overlap.date_to > leave.date_from:
                    raise ValidationError(_('Two leaves for the same target cannot overlap.'))
