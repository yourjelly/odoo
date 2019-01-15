# -*- coding: utf-8 -*-
from odoo import api, models, _
from odoo.exceptions import UserError

class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    @api.multi
    def unlink(self):
        for employee in self:
            pos_session_ids = self.env['pos.session'].search([('state','!=','closed'), ('module_pos_employee', '=', True), '|', ('employee_ids', 'in', employee.id), ('employee_ids', '=', False)]).ids
            if len(pos_session_ids):
                raise UserError(_("You cannot delete Employees that are used by active PoS sessions.\n")\
                        + _("Employee: ") + str(employee.id) + "\n"\
                        + _("PoS Sessions: ") + ", ".join(str(pos_session_id) for pos_session_id in pos_session_ids))
        return super(HrEmployee, self).unlink()
