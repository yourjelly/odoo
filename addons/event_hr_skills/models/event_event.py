from odoo import _, fields, models
from odoo.exceptions import UserError
from odoo.osv import expression


class EventEvent(models.Model):
    _inherit = ['event.event']
    is_active_employee_registered = fields.Boolean(store=False, search='_search_is_active_employee_registered')

    def _search_is_active_employee_registered(self, operator, value):
        if not operator in ['=', '!=']:
            raise UserError(_('Operator not supported'))

        if employee_id := self.env.context.get('active_employee_id'):
            domain = [
                ('registration_ids', 'any', [
                    ('partner_id.employee_ids', 'any', [('id', '=', employee_id)]),
                    ('state', 'in', ['open', 'done'])
                ])
            ]
        else:
            domain = expression.FALSE_LEAF

        if value != (operator == '='):
            domain = ['!', *domain]

        return domain

    def action_register_employee(self):
        employee = self.env['hr.employee'].browse(self.env.context.get('active_employee_id'))
        if not employee or not employee.work_contact_id:
            return
        self.env['event.registration'].create([{
            'state': 'done',
            'partner_id': employee.work_contact_id.id,
            'event_id': event.id,
        } for event in self])
