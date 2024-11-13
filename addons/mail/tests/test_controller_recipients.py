import json

from odoo.addons.base.tests.common import HttpCaseWithUserDemo
from odoo.tests import tagged
from odoo.tools import mute_logger


@tagged("-at_install", "post_install", "mail_controller")
class TestMessageController(HttpCaseWithUserDemo):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

    @mute_logger("odoo.addons.http_routing.models.ir_http", "odoo.http")
    def test_mail_partner_from_email_authenticated(self):
        self.authenticate(None, None)
        self.opener.cookies[self.guest._cookie_name] = self.guest._format_auth_cookie()
        res1 = self.url_open(
            url="/mail/partner/from_email",
            data=json.dumps(
                {
                    "params": {
                        "thread_model": "discuss.channel",
                        "thread_id": self.channel.id,
                        "emails": ["john@test.be"],
                    },
                }
            ),
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(
            0,
            self.env["res.partner"].search_count([('email', '=', "john@test.be")]),
            "guest should not be allowed to create a partner from an email",
        )
        res2 = self.url_open(
            url="/mail/message/post",
            data=json.dumps(
                {
                    "params": {
                        "thread_model": "discuss.channel",
                        "thread_id": self.channel.id,
                        "post_data": {
                            "body": "test",
                        },
                        "partner_emails": ["john@test.be"],
                    },
                }
            ),
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(
            0,
            self.env["res.partner"].search_count([('email', '=', "john@test.be")]),
            "guest should not be allowed to create a partner from an email from message_post",
        )
        demo = self.authenticate("demo", "demo")
        res3 = self.url_open(
            url="/mail/partner/from_email",
            data=json.dumps(
                {
                    "params": {
                        "thread_model": "discuss.channel",
                        "thread_id": self.channel.id,
                        "emails": ["john@test.be"],
                        'additional_values': {"john@test.be": {'phone': '123456789'}},
                    },
                }
            ),
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(res3.status_code, 200)
        self.assertEqual(
            1,
            self.env["res.partner"].search_count([('email', '=', "john@test.be"), ('phone', '=', "123456789")]),
            "authenticated users can create a partner from an email",
        )
        # should not create another partner with same email
        res4 = self.url_open(
            url="/mail/partner/from_email",
            data=json.dumps(
                {
                    "params": {
                        "thread_model": "discuss.channel",
                        "thread_id": self.channel.id,
                        "emails": ["john@test.be"],
                    },
                }
            ),
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(res4.status_code, 200)
        self.assertEqual(
            1,
            self.env["res.partner"].search_count([('email', '=', "john@test.be")]),
            "'mail/partner/from_email' does not create another user if there's already a user with matching email",
        )
        self.channel.add_members(
            self.env["res.users"].browse(demo.uid).partner_id.ids # so demo can post message
        )
        res5 = self.url_open(
            url="/mail/message/post",
            data=json.dumps(
                {
                    "params": {
                        "thread_model": "discuss.channel",
                        "thread_id": self.channel.id,
                        "post_data": {
                            "body": "test",
                        },
                        "partner_emails": ["john2@test.be"],
                        "partner_additional_values": {"john2@test.be": {'phone': '123456789'}},
                    },
                }
            ),
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(res5.status_code, 200)
        self.assertEqual(
            1,
            self.env["res.partner"].search_count([('email', '=', "john2@test.be"), ('phone', '=', "123456789")]),
            "authenticated users can create a partner from an email from message_post",
        )
        # should not create another partner with same email
        res6 = self.url_open(
            url="/mail/message/post",
            data=json.dumps(
                {
                    "params": {
                        "thread_model": "discuss.channel",
                        "thread_id": self.channel.id,
                        "post_data": {
                            "body": "test",
                        },
                        "partner_emails": ["john2@test.be"],
                    },
                }
            ),
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(res6.status_code, 200)
        self.assertEqual(
            1,
            self.env["res.partner"].search_count([('email', '=', "john2@test.be")]),
            "'mail/message/post' does not create another user if there's already a user with matching email",
        )