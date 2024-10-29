import base64
import textwrap

import odoo
from odoo.addons.base.tests.common import HttpCaseWithUserDemo
from odoo import http


@odoo.tests.tagged("-at_install", "post_install")
class TestAccountMoveAttachment(HttpCaseWithUserDemo):

    def test_preserving_manually_added_attachments(self):
        """ Preserve attachments manually added (not coming from emails) to an invoice """
        self.authenticate("admin", "admin")

        invoice_manual = self.env['account.move'].create({
            'move_type': 'in_invoice',
            'extract_state':
            'not_enough_credit'
        })
        response = self.url_open("/mail/attachment/upload",
            {
                "csrf_token": http.Request.csrf_token(self),
                "thread_id": invoice_manual.id,
                "thread_model": "account.move",
            },
            files={"ufile": b""},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(invoice_manual.attachment_ids)
