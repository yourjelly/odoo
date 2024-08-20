import threading

from odoo import fields, models, tools


class EventMail(models.Model):
    _inherit = "event.mail"

    last_registration_id = fields.Many2one("event.registration", "Last Registration")

    def _execute_event_based(self):
        if self.notification_type == "social_post":
            return super()._execute_event_based()

        auto_commit = not getattr(threading.current_thread(), 'testing', False)
        batch_size = int(
            self.env['ir.config_parameter'].sudo().get_param('mail.batch_size')
        ) or 50  # be sure to not have 0, as otherwise no iteration is done
        cron_limit = int(
            self.env['ir.config_parameter'].sudo().get_param('mail.render.cron.limit')
        ) or 1000  # be sure to not have 0, as otherwise we will loop

        # fetch registrations to contact
        registration_domain = [
            ("event_id", "=", self.event_id.id),
            ("state", "not in", ["draft", "cancel"]),
        ]
        if self.last_registration_id:
            registration_domain += [("id", ">", self.last_registration_id.id)]
        registrations = self.env["event.registration"].search(registration_domain, limit=(cron_limit + 1), order="id ASC")

        # no registrations -> done
        if not registrations:
            self.mail_done = True
            return

        # there are more than planned for the cron -> reschedule
        if len(registrations) > cron_limit:
            registrations = registrations[:cron_limit]
            self.env.ref('event.event_mail_scheduler')._trigger()

        for registrations_chunk in tools.split_every(batch_size, registrations.ids, self.env["event.registration"].browse):
            self._execute_event_based_for_registrations(registrations_chunk)
            self.last_registration_id = registrations[-1].id
            self.mail_count_done = self.mail_count_done + len(registrations_chunk)
            self.mail_done = self.mail_count_done >= self.event_id.seats_taken
            if auto_commit:
                self.env.cr.commit()
