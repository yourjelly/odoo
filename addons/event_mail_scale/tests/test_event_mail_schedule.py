
from datetime import datetime, timedelta
from unittest.mock import patch

from odoo.addons.base.tests.test_ir_cron import CronMixinCase
from odoo.addons.event.tests.common import EventCase
from odoo.addons.mail.tests.common import MailCommon
from odoo.tests import tagged, users


class EventMailSchedulerCommon(EventCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.event_cron_id = cls.env.ref('event.event_mail_scheduler')
        # deactivate other schedulers to avoid messing with crons
        cls.env['event.mail'].search([]).unlink()
        # consider asynchronous sending as default sending
        cls.env["ir.config_parameter"].set_param("event.event_mail_async", False)

        cls.env.company.write({
            'email': 'info@yourcompany.example.com',
            'name': 'YourCompany',
        })


@tagged('event_mail', 'post_install', '-at_install')
class TestEventMailScale(EventMailSchedulerCommon, MailCommon, CronMixinCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # freeze some datetimes, and ensure more than 1D+1H before event starts
        # to ease time-based scheduler check
        # Since `now` is used to set the `create_date` of an event and create_date
        # has often microseconds, we set it to ensure that the scheduler we still be
        # launched if scheduled_date == create_date - microseconds
        cls.reference_now = datetime(2021, 3, 20, 14, 30, 15, 123456)
        cls.event_date_begin = datetime(2021, 3, 25, 8, 0, 0)
        cls.event_date_end = datetime(2021, 3, 28, 18, 0, 0)

        cls._setup_test_reports()
        with cls.mock_datetime_and_now(cls, cls.reference_now):
            cls.test_event = cls.env['event.event'].create({
                'name': 'TestEventMail',
                'user_id': cls.user_eventmanager.id,
                'date_begin': cls.event_date_begin,
                'date_end': cls.event_date_end,
                'event_mail_ids': [
                    (0, 0, {  # right at subscription: mail
                        'interval_unit': 'now',
                        'interval_type': 'after_sub',
                        'notification_type': 'mail',
                        'template_ref': f'mail.template,{cls.template_subscription.id}',
                    }),
                    (0, 0, {  # 3 days before event: mail
                        'interval_nbr': 3,
                        'interval_unit': 'days',
                        'interval_type': 'before_event',
                        'notification_type': 'mail',
                        'template_ref': f'mail.template,{cls.template_reminder.id}',
                    }),
                    (0, 0, {  # 1h after event: mail
                        'interval_nbr': 1,
                        'interval_unit': 'hours',
                        'interval_type': 'after_event',
                        'notification_type': 'mail',
                        'template_ref': f'mail.template,{cls.template_reminder.id}',
                    }),
                ]
            })

    @patch('odoo.addons.event.models.event_mail.EventMailScheduler._execute_event_based_for_registrations')
    @users('user_eventmanager')
    def test_schedule_global_scalability(self, patched_scheduler_exec):
        test_event = self.env['event.event'].browse(self.test_event.ids)

        sub_mail = test_event.event_mail_ids.filtered(lambda s: s.interval_type == "after_sub" and s.interval_unit == "now" and s.notification_type == "mail")
        self.assertEqual(len(sub_mail), 1)
        self.assertEqual(sub_mail.mail_count_done, 0)
        self.assertFalse(sub_mail.mail_done)

        # setup batch and cron limit sizes to check iterative behavior
        batch_size, cron_limit = 5, 20
        self.env["ir.config_parameter"].sudo().set_param("mail.batch_size", batch_size)
        self.env["ir.config_parameter"].sudo().set_param("mail.render.cron.limit", cron_limit)

        with self.mock_datetime_and_now(self.reference_now + timedelta(hours=1)), \
             self.mock_mail_gateway():
            self._create_registrations(test_event, 30)

        # iterative work on registrations, force cron to close those
        self.assertEqual(sub_mail.mail_count_done, 20)
        with self.mock_datetime_and_now(self.reference_now + timedelta(hours=1)), \
             self.mock_mail_gateway(), \
             self.capture_triggers('event.event_mail_scheduler') as capture:
            self.event_cron_id.method_direct_trigger()
        self.assertEqual(sub_mail.mail_count_done, 30)
        self.assertTrue(sub_mail.mail_done)
        self.assertFalse(capture.records)

        # check before event schedulers
        before_mail = test_event.event_mail_ids.filtered(lambda s: s.interval_type == "before_event" and s.notification_type == "mail")
        self.assertEqual(len(before_mail), 1)
        self.assertEqual(before_mail.mail_count_done, 0)
        self.assertFalse(before_mail.mail_done)

        current_now = self.event_date_begin - timedelta(days=1)
        with self.mock_datetime_and_now(current_now), \
             self.mock_mail_gateway(), \
             self.capture_triggers('event.event_mail_scheduler') as capture:
            self.event_cron_id.method_direct_trigger()

        self.assertEqual(before_mail.mail_count_done, 20)
        self.assertFalse(before_mail.mail_done)
        # check was done in loop (by scheduler)
        self.assertEqual(patched_scheduler_exec.call_count, 4)

        # did not do all registrations -> trigger should have been generated for each scheduler
        self.assertEqual(len(capture.records), 1)
        for trigger in capture.records:
            self.assertEqual(trigger.call_at, current_now)
            self.assertEqual(trigger.cron_id, self.env.ref('event.event_mail_scheduler'))

        # relaunch cron, should finish its job (2*20 > 30 attendees to contact)
        with self.mock_datetime_and_now(current_now), \
             self.mock_mail_gateway(), \
             self.capture_triggers('event.event_mail_scheduler') as capture:
            self.event_cron_id.method_direct_trigger()

        self.assertEqual(before_mail.mail_count_done, 30)
        self.assertTrue(before_mail.mail_done)
        # check was done in loop (by scheduler)
        self.assertEqual(patched_scheduler_exec.call_count, 6)
