from datetime import datetime, time
from dateutil.relativedelta import relativedelta
from pytz import timezone, UTC

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class ResourceLeaveMixin(models.AbstractModel):
    _name = "resource.leave.mixin"
    _description = "Resource Leave Mixin"
    _order = "date_from"

    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        if 'date_from' in fields_list and 'date_to' in fields_list and not res.get('date_from') and not res.get('date_to'):
            # Then we give the current day and we search the begin and end hours for this day in resource.calendar of the current company
            today = fields.Datetime.now()
            user_tz = timezone(self.env.user.tz or self._context.get('tz') or self.company_id.resource_calendar_id.tz or 'UTC')
            date_from = user_tz.localize(datetime.combine(today, time.min))
            date_to = user_tz.localize(datetime.combine(today, time.max))
            intervals = self.env.company.resource_calendar_id._work_intervals_batch(date_from.replace(tzinfo=UTC), date_to.replace(tzinfo=UTC))[False]
            if intervals:  # Then we stop and return the dates given in parameter
                list_intervals = [(start, stop) for start, stop, records in intervals]  # Convert intervals in interval list
                date_from = list_intervals[0][0]  # We take the first date in the interval list
                date_to = list_intervals[-1][1]  # We take the last date in the interval list
            res.update(
                date_from=date_from.astimezone(UTC).replace(tzinfo=None),
                date_to=date_to.astimezone(UTC).replace(tzinfo=None)
            )
        return res

    description = fields.Char(string='Reason')
    resource_leave_id = fields.Many2one(comodel_name='resource.resource.leave',
        auto_join=True, index=True, ondelete='restrict', required=True,
        export_string_translation=False)
    date_from = fields.Datetime(related='resource_leave_id.date_from',
        string='Start Date', required=True)
    date_to = fields.Datetime(related='resource_leave_id.date_to',
        string='End Date', required=True,
        compute='_compute_date_to', readonly=False, store=True)
    resource_id = fields.Many2one(related='resource_leave_id.resource_id',
        string='Resource', index=True, required=True)
    company_id = fields.Many2one(comodel_name='res.company', related='resource_id.company_id', store=True)
    time_type = fields.Selection(related='resource_leave_id.time_type', default='leave')
    tz_mismatch = fields.Boolean(compute='_compute_tz_mismatch')
    tz = fields.Selection(related='resource_leave_id.tz', compute='_compute_tz', store=True)

    _sql_constraints = [
        ('date_check', "CHECK(date_from <= date_to)", "The start date must be anterior to the end date."),
    ]

    @api.depends('date_from')
    def _compute_date_to(self):
        user_tz = timezone(self.env.user.tz or self._context.get('tz') or self.company_id.resource_calendar_id.tz or 'UTC')
        for leave in self:
            date_to_tz = user_tz.localize(leave.date_from) + relativedelta(hour=23, minute=59, second=59)
            leave.date_to = date_to_tz.astimezone(UTC).replace(tzinfo=None)

    @api.depends('resource_id.tz')
    def _compute_tz(self):
        for leave in self:
            leave.tz = leave.resource_id.tz\
                or self.env.company.resource_calendar_id.tz\
                or self.env.user.tz or 'UTC'

    @api.depends('tz')
    @api.depends_context('uid')
    def _compute_tz_mismatch(self):
        for leave in self:
            leave.tz_mismatch = leave.tz != self.env.user.tz

    def _get_resource_leave_vals(self, vals_list):
        return [{
            'date_from': vals.get('date_from'),
            'date_to': vals.get('date_to'),
            'resource_id': vals.get('resource_id'),
            'time_type': vals.get('time_type'),
            'tz': vals.get('tz'),
        } for vals in vals_list if 'resource_leave_id' not in vals]

    def create(self, vals_list):
        resource_leave_vals = self._get_resource_leave_vals(vals_list)
        if resource_leave_vals:
            leaves = self.env['resource.resource.leave'].create(resource_leave_vals)
            resources_iter = iter(leaves.ids)
            for vals in vals_list:
                if not vals.get('resource_leave_id'):
                    vals['resource_leave_id'] = next(resources_iter)
        return super().create(vals_list)
