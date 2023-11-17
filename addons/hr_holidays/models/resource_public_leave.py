from odoo import api, models
from odoo.exceptions import ValidationError
from odoo.osv import expression
from odoo.tools.translate import _


class ResourcePublicLeave(models.Model):
    _inherit = 'resource.public.leave'

    def _get_time_domain_dict(self):
        return [{
            'company_ids': record.company_ids.ids,
            'date_from': record.datetime_from,
            'date_to': record.datetime_to
        } for record in self]

    def _get_leave_domain(self, time_domain_dict):
        domain = []
        for date in time_domain_dict:
            domain = expression.OR([domain, [
                ('company_id', 'in', date['company_ids']),
                ('date_to', '>', date['date_from']),
                ('date_from', '<', date['date_to'])]
            ])
        return expression.AND([domain, [('state', 'not in', ['refuse', 'cancelled'])]])

    def _reevaluate_leaves(self, time_domain_dict):
        if not time_domain_dict:
            return

        domain = self._get_leave_domain(time_domain_dict)
        leaves = self.env['hr.leave'].search(domain)
        if not leaves:
            return

        previous_durations = leaves.mapped('number_of_days')
        previous_states = leaves.mapped('state')
        leaves.sudo().write({
            'state': 'draft',
        })
        self.env.add_to_compute(self.env['hr.leave']._fields['number_of_days'], leaves)
        self.env.add_to_compute(self.env['hr.leave']._fields['duration_display'], leaves)
        for previous_duration, leave, state in zip(previous_durations, leaves, previous_states):
            duration_difference = previous_duration - leave.number_of_days
            message = False
            if leave.holiday_status_id.requires_allocation == 'no':
                leave.write({'state': state})
                continue
            if duration_difference > 0:
                message = _("Due to a change in global time offs, you have been granted %s day(s) back.", duration_difference)
            if leave.number_of_days > previous_duration:
                message = _("Due to a change in global time offs, %s extra day(s) have been taken from your allocation. Please review this leave if you need it to be changed.", -1 * duration_difference)
            try:
                leave.write({'state': state})
                leave._check_validity()
            except ValidationError:
                leave.action_refuse()
                message = _("Due to a change in global time offs, this leave no longer has the required amount of available allocation and has been set to refused. Please review this leave.")
            if message:
                leave._notify_change(message)

    @api.model_create_multi
    def create(self, vals_list):
        res = super().create(vals_list)
        time_domain_dict = res._get_time_domain_dict()
        self._reevaluate_leaves(time_domain_dict)
        return res

    def write(self, vals):
        time_domain_dict = self._get_time_domain_dict()
        res = super().write(vals)
        time_domain_dict.extend(self._get_time_domain_dict())
        self._reevaluate_leaves(time_domain_dict)
        return res

    def unlink(self):
        time_domain_dict = self._get_time_domain_dict()
        res = super().unlink()
        self._reevaluate_leaves(time_domain_dict)
        return res
