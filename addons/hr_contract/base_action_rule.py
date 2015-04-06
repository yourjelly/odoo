# -*- coding: utf-8 -*-

from openerp.addons.base_action_rule.base_action_rule import get_datetime
from openerp import api, fields, models


class BaseActionRule(models.Model):
    """ Add resource and calendar for time-based conditions """
    _name = 'base.action.rule'
    _inherit = ['base.action.rule']

    trg_date_resource_field_id = fields.Many2one(
        'ir.model.fields', 'Use employee work schedule',
        help='Use the user\'s working schedule.'
    )

    @api.multi
    def _check_delay(self, record, record_dt):
        """ Override the check of delay to try to use a user-related calendar.
        If no calendar is found, fallback on the default behavior. """
        self.ensure_one()
        if self.trg_date_calendar_id and self.trg_date_range_type == 'day' and self.trg_date_resource_field_id:
            user = record[self.trg_date_resource_field_id.name]
            if user.employee_ids and user.employee_ids[0].contract_id \
                    and user.employee_ids[0].contract_id.working_hours:
                calendar = user.employee_ids[0].contract_id.working_hours
                start_dt = get_datetime(record_dt)
                resource_id = user.employee_ids[0].resource_id.id
                action_dt = calendar.schedule_days_get_date(
                    days=self.trg_date_range,
                    day_date=start_dt, compute_leaves=True, resource_id=resource_id
                 )
                return action_dt
        return super(BaseActionRule, self)._check_delay(record, record_dt)
