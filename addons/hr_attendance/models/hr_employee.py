# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import pytz
from dateutil.relativedelta import relativedelta

from odoo import models, fields, api, exceptions, _
from odoo.tools import float_round


class HrEmployee(models.Model):
    _inherit = "hr.employee"

    attendance_ids = fields.One2many(
        'hr.attendance', 'employee_id', groups="hr_attendance.group_hr_attendance_user,hr.group_hr_user")
    attendance_day_ids = fields.One2many('hr.attendance.day', 'employee_id', groups="hr_attendance.group_hr_attendance_user,hr.group_hr_user")
    last_attendance_id = fields.Many2one(
        'hr.attendance', compute='_compute_last_attendance_id', store=True,
        groups="hr_attendance.group_hr_attendance_kiosk,hr_attendance.group_hr_attendance,hr.group_hr_user")
    last_attendance_day_id = fields.Many2one('hr.attendance.day', compute='_compute_last_attendance_day_id', store=True,
                                             groups="hr_attendance.group_hr_attendance_kiosk,hr_attendance.group_hr_attendance,hr.group_hr_user")
    last_check_in = fields.Datetime(
        related='last_attendance_id.check_in', store=True,
        groups="hr_attendance.group_hr_attendance_user,hr.group_hr_user")
    last_check_out = fields.Datetime(
        related='last_attendance_id.check_out', store=True,
        groups="hr_attendance.group_hr_attendance_user,hr.group_hr_user")
    attendance_state = fields.Selection(
        string="Attendance Status", compute='_compute_attendance_state',
        selection=[('checked_out', "Checked out"), ('checked_in', "Checked in")],
        groups="hr_attendance.group_hr_attendance_kiosk,hr_attendance.group_hr_attendance,hr.group_hr_user")
    in_break = fields.Boolean(string="Break Status", compute='_compute_in_break',
                              groups="hr_attendance.group_hr_attendance_kiosk,hr_attendance.group_hr_attendance,hr.group_hr_user")
    hours_last_month = fields.Float(
        compute='_compute_hours_last_month', groups="hr_attendance.group_hr_attendance_user,hr.group_hr_user")
    hours_today = fields.Float(
        compute='_compute_hours_today',
        groups="hr_attendance.group_hr_attendance_kiosk,hr_attendance.group_hr_attendance,hr.group_hr_user")
    break_today = fields.Float(
        compute='_compute_break_today',
        groups="hr_attendance.group_hr_attendance_kiosk,hr_attendance.group_hr_attendance,hr.group_hr_user")
    hours_last_month_display = fields.Char(
        compute='_compute_hours_last_month', groups="hr_attendance.group_hr_attendance_user,hr.group_hr_user")
    overtime_ids = fields.One2many(
        'hr.attendance.overtime', 'employee_id', groups="hr_attendance.group_hr_attendance_user,hr.group_hr_user")
    total_overtime = fields.Float(
        compute='_compute_total_overtime', compute_sudo=True,
        groups="hr_attendance.group_hr_attendance_kiosk,hr_attendance.group_hr_attendance,hr.group_hr_user")

    @api.depends('overtime_ids.duration', 'attendance_ids')
    def _compute_total_overtime(self):
        for employee in self:
            if employee.company_id.hr_attendance_overtime:
                employee.total_overtime = float_round(sum(employee.overtime_ids.mapped('duration')), 2)
            else:
                employee.total_overtime = 0

    def _compute_hours_last_month(self):
        now = fields.Datetime.now()
        now_utc = pytz.utc.localize(now)
        for employee in self:
            tz = pytz.timezone(employee.tz or 'UTC')
            now_tz = now_utc.astimezone(tz)
            start_tz = now_tz + relativedelta(months=-1, day=1, hour=0, minute=0, second=0, microsecond=0)
            start_naive = start_tz.astimezone(pytz.utc).replace(tzinfo=None)
            end_tz = now_tz + relativedelta(day=1, hour=0, minute=0, second=0, microsecond=0)
            end_naive = end_tz.astimezone(pytz.utc).replace(tzinfo=None)

            attendances = self.env['hr.attendance'].search([
                ('employee_id', '=', employee.id),
                '&',
                ('check_in', '<=', end_naive),
                ('check_out', '>=', start_naive),
            ])

            hours = 0
            for attendance in attendances:
                check_in = max(attendance.check_in, start_naive)
                check_out = min(attendance.check_out, end_naive)
                hours += (check_out - check_in).total_seconds() / 3600.0

            employee.hours_last_month = round(hours, 2)
            employee.hours_last_month_display = "%g" % employee.hours_last_month

    def _compute_hours_today(self):
        for employee in self:
            if employee.last_attendance_day_id and employee.last_attendance_day_id.attendance_day == fields.Date.today():
                employee.hours_today = employee.last_attendance_day_id.work_time
            else:
                employee.hours_today = 0

    def _compute_break_today(self):
        for employee in self:
            if employee.last_attendance_day_id and employee.last_attendance_day_id.attendance_day == fields.Date.today():
                employee.break_today = employee.last_attendance_day_id.break_time
            else:
                employee.break_today = 0

    @api.depends('attendance_ids', 'attendance_day_ids')
    def _compute_last_attendance_id(self):
        for employee in self:
            employee.last_attendance_id = self.env['hr.attendance'].search([
                ('employee_id', '=', employee.id),
                ('attendance_day_id', '=', employee.last_attendance_day_id.id)
            ], limit=1, order='check_in desc')

    @api.depends('attendance_day_ids')
    def _compute_last_attendance_day_id(self):
        for employee in self:
            employee.last_attendance_day_id = self.env['hr.attendance.day'].search([
                ('employee_id', '=', employee.id),
            ], limit=1)

    @api.depends('last_attendance_id.check_in', 'last_attendance_id.check_out', 'last_attendance_id')
    def _compute_attendance_state(self):
        for employee in self:
            att = employee.last_attendance_id.sudo()
            employee.attendance_state = att and not att.check_out and 'checked_in' or 'checked_out'

    @api.depends('last_attendance_id.check_in', 'last_attendance_id.check_out', 'last_attendance_id')
    def _compute_in_break(self):
        for employee in self:
            att = employee.last_attendance_id.sudo()
            employee.in_break = True if att.type == 'break' else False

    @api.model
    def attendance_scan(self, barcode):
        """ Receive a barcode scanned from the Kiosk Mode and change the attendances of corresponding employee.
            Returns either an action or a warning.
        """
        employee = self.sudo().search([('barcode', '=', barcode)], limit=1)
        if employee:
            return employee._attendance_action('hr_attendance.hr_attendance_action_kiosk_mode')
        return {'warning': _("No employee corresponding to Badge ID '%(barcode)s.'") % {'barcode': barcode}}

    def attendance_manual(self, next_action, entered_pin=None):
        self.ensure_one()
        attendance_user_and_no_pin = self.user_has_groups(
            'hr_attendance.group_hr_attendance_user,'
            '!hr_attendance.group_hr_attendance_use_pin')
        can_check_without_pin = attendance_user_and_no_pin or (self.user_id == self.env.user and entered_pin is None)
        if can_check_without_pin or entered_pin is not None and entered_pin == self.sudo().pin:
            return self._attendance_action(next_action)
        if not self.user_has_groups('hr_attendance.group_hr_attendance_user'):
            return {'warning': _('To activate Kiosk mode without pin code, you must have access right as an Officer or above in the Attendance app. Please contact your administrator.')}
        return {'warning': _('Wrong PIN')}

    def break_manual(self, next_action, entered_pin=None):
        self.ensure_one()
        attendance_user_and_no_pin = self.user_has_groups(
            'hr_attendance.group_hr_attendance_user,'
            '!hr_attendance.group_hr_attendance_use_pin')
        can_check_without_pin = attendance_user_and_no_pin or (self.user_id == self.env.user and entered_pin is None)
        if can_check_without_pin or entered_pin is not None and entered_pin == self.sudo().pin:
            return self._break_action(next_action)
        if not self.user_has_groups('hr_attendance.group_hr_attendance_user'):
            return {'warning': _('To activate Kiosk mode without pin code, you must have access right as an Officer or above in the Attendance app. Please contact your administrator.')}
        return {'warning': _('Wrong PIN')}

    def _attendance_action(self, next_action):
        """ Changes the attendance of the employee.
            Returns an action to the check in/out message,
            next_action defines which menu the check in/out message should return to. ("My Attendances" or "Kiosk Mode")
        """
        self.ensure_one()
        employee = self.sudo()
        action_message = self.env["ir.actions.actions"]._for_xml_id("hr_attendance.hr_attendance_action_greeting_message")
        action_message['previous_attendance_change_date'] = employee.last_attendance_id and (employee.last_attendance_id.check_out or employee.last_attendance_id.check_in) or False
        action_message['employee_name'] = employee.name
        action_message['barcode'] = employee.barcode
        action_message['next_action'] = next_action
        action_message['hours_today'] = employee.hours_today
        action_message['break_today'] = employee.break_today
        action_message['kiosk_delay'] = employee.company_id.attendance_kiosk_delay * 1000

        if employee.user_id:
            modified_attendance = employee.with_user(employee.user_id).sudo()._attendance_action_change()
        else:
            modified_attendance = employee._attendance_action_change()
        action_message['attendance'] = modified_attendance.read()[0]
        action_message['total_overtime'] = employee.total_overtime
        # Overtime have an unique constraint on the day, no need for limit=1
        action_message['overtime_today'] = self.env['hr.attendance.overtime'].sudo().search([
            ('employee_id', '=', employee.id), ('date', '=', fields.Date.context_today(self)), ('adjustment', '=', False)]).duration or 0
        return {'action': action_message}

    def _break_action(self, next_action):
        self.ensure_one()
        employee = self.sudo()
        action_message = self.env["ir.actions.actions"]._for_xml_id("hr_attendance.hr_attendance_action_greeting_message")
        action_message['previous_attendance_change_date'] = employee.last_attendance_id and (employee.last_attendance_id.check_out or employee.last_attendance_id.check_in) or False
        action_message['employee_name'] = employee.name
        action_message['barcode'] = employee.barcode
        action_message['next_action'] = next_action
        action_message['hours_today'] = employee.hours_today
        action_message['break_today'] = employee.break_today
        action_message['kiosk_delay'] = employee.company_id.attendance_kiosk_delay * 1000

        if employee.user_id:
            modified_attendance = employee.with_user(employee.user_id).sudo()._break_action_change()
        else:
            modified_attendance = employee._break_action_change()
        action_message['attendance'] = modified_attendance.read()[0]
        action_message['in_break'] = employee.in_break
        action_message['total_overtime'] = employee.total_overtime
        # Overtime have an unique constraint on the day, no need for limit=1
        action_message['overtime_today'] = self.env['hr.attendance.overtime'].sudo().search([
            ('employee_id', '=', employee.id), ('date', '=', fields.Date.context_today(self)), ('adjustment', '=', False)]).duration or 0
        return {'action': action_message}

    def _break_action_change(self):
        self.ensure_one()
        action_date = fields.Datetime.now()
        if not self.last_attendance_id.check_out and self.last_attendance_id.type == 'work':
            self.last_attendance_id.check_out = action_date
            vals = {
                'employee_id': self.id,
                'check_in': action_date,
                'type': 'break'
            }
            created_attendance = self.env['hr.attendance'].create(vals)
            self.last_attendance_day_id.attendance_ids |= created_attendance
            return created_attendance

        else:
            if self.last_attendance_id:
                self.last_attendance_id.check_out = action_date
                vals = {
                    'employee_id': self.id,
                    'check_in': action_date,
                }
                created_attendance = self.env['hr.attendance'].create(vals)
                self.last_attendance_day_id.attendance_ids |= created_attendance
                return created_attendance

    def get_attendance_states(self):
        return 

    def _attendance_action_change(self):
        """ Check In/Check Out action
            Check In: create a new attendance record
            Check Out: modify check_out field of appropriate attendance record
        """
        self.ensure_one()
        action_date = fields.Datetime.now()
        today_date = fields.Date.today()

        if not self.last_attendance_day_id or self.last_attendance_day_id.attendance_day < today_date:
            vals = {
                'employee_id': self.id,
                'attendance_day': today_date,
            }
            self.env['hr.attendance.day'].create(vals)

        if self.attendance_state != 'checked_in':
            if self.last_attendance_day_id and self.last_attendance_day_id.last_check_out and self.last_attendance_day_id.attendance_day == today_date: # create out attendance
                out_vals = {
                    'employee_id': self.id,
                    'check_in': self.last_attendance_day_id.last_check_out,
                    'check_out': action_date,
                    'type': 'out'
                }
                out_attendance = self.env['hr.attendance'].create(out_vals)
                self.last_attendance_day_id.attendance_ids |= out_attendance
            vals = {
                'employee_id': self.id,
                'check_in': action_date,
            }
            created_attendance = self.env['hr.attendance'].create(vals)
            self.last_attendance_day_id.attendance_ids |= created_attendance
            return created_attendance
        attendance = self.env['hr.attendance'].search([('employee_id', '=', self.id),
                                                       ('check_out', '=', False),
                                                       ('attendance_day_id', '=', self.last_attendance_day_id.id)],
                                                        limit=1)
        if attendance:
            attendance.check_out = action_date
        else:
            raise exceptions.UserError(_('Cannot perform check out on %(empl_name)s, could not find corresponding check in. '
                'Your attendances have probably been modified manually by human resources.') % {'empl_name': self.sudo().name, })
        return attendance
