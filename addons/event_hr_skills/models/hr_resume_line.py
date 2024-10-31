from odoo import _, api, fields, models
from odoo.exceptions import UserError


class HrResumeLine(models.Model):
    _inherit = ['hr.resume.line']

    event_registration_id = fields.Many2one('event.registration', ondelete='cascade')
    line_type_id = fields.Many2one('hr.resume.line.type', domain=lambda self: [('id', '!=', self.get_event_type_id())])

    @api.model
    def get_event_type_id(self):
        return self.env.ref('event_hr_skills.resume_type_events').id


class HrResumeLineType(models.Model):
    _inherit = ['hr.resume.line.type']

    @api.ondelete(at_uninstall=False)
    def _uninstall_except_event_type(self):
        if self.env['hr.resume.line'].get_event_type_id() in self.ids:
            raise UserError(_("Event resume line type cannot be deleted"))
