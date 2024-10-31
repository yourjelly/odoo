from odoo import api, fields, models


class EventRegistration(models.Model):
    _inherit = ['event.registration']

    employee_ids = fields.One2many(related='partner_id.employee_ids', readonly=True)
    resume_line_ids = fields.One2many(
        'hr.resume.line',
        'event_registration_id',
        readonly=True,
        store=True,
        compute='_compute_resume_line_ids',
    )

    def _show_event_on_resume(self):
        self.ensure_one()
        return (
            self.employee_ids
            and self.state == 'done'
            and any(self.event_id.tag_ids.mapped('show_on_resume'))
        )

    @api.depends('employee_ids', 'state', 'event_id.tag_ids.show_on_resume')
    def _compute_resume_line_ids(self):
        create_vals_list = []
        for registration in self:
            if not registration._show_event_on_resume():
                registration.resume_line_ids.unlink()
                continue

            resume_line_vals_list = [{
                'employee_id': employee.id,
                'event_registration_id': registration.id,
                'name': registration.event_id.name,
                'date_start': registration.event_id.date_begin,
                'date_end': registration.event_id.date_end,
                'description': 'Attended event: ' + registration.event_id.name,
                'line_type_id': self.env['hr.resume.line'].get_event_type_id(),
            } for employee in registration.employee_ids]

            # reuse old lines as much as possible
            count = min(len(resume_line_vals_list), len(registration.resume_line_ids))
            registration.resume_line_ids[count:].unlink()
            for line, vals in zip(registration.resume_line_ids, resume_line_vals_list):
                line.write(vals)

            if not registration.id:
                # at create time: id may not yet be available (needed ?)
                registration.resume_line_ids |= self.env['hr.resume.line'].create(resume_line_vals_list[count:])
            else:
                # registration already exists: create in batch and link via reciprocal relation
                create_vals_list.extend(resume_line_vals_list[count:])

        self.env['hr.resume.line'].create(create_vals_list)
