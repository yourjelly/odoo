import base64
import textwrap

import odoo
from odoo.addons.base.tests.common import HttpCaseWithUserDemo
from odoo import http


@odoo.tests.tagged("-at_install", "post_install")
class TestAccountMoveAttachment(HttpCaseWithUserDemo):

    def _get_email_for_journal_alias(self, attachment=b'My attachment', attach_content_type='application/octet-stream', message_id='some_msg_id'):
        attachment = base64.b64encode(attachment).decode()
        journal_with_alias = self.env['account.journal'].search(
            [('company_id', '=', self.env.user.company_id.id), ('type', '=', 'purchase')],
            limit=1,
        )
        alias = journal_with_alias.alias_id
        return textwrap.dedent(f'''\
            MIME-Version: 1.0
            Date: Fri, 26 Nov 2021 16:27:45 +0100
            Message-ID: {message_id}
            Subject: Incoming bill
            From:  Someone <someone@some.company.com>
            To: {alias.display_name}
            Content-Type: multipart/alternative; boundary="000000000000a47519057e029630"

            --000000000000a47519057e029630
            Content-Type: text/plain; charset=\"UTF-8\"


            --000000000000a47519057e029630
            Content-Type: {attach_content_type}
            Content-Transfer-Encoding: base64

            {attachment}

            --000000000000a47519057e029630--
        ''')

    def test_account_move_attachments(self):
        # Case 1: Discard attachments coming from emails
        mail = self._get_email_for_journal_alias()
        invoice_email = self.env['account.move'].browse(self.env['mail.thread'].message_process('account.move', mail))
        self.assertFalse(invoice_email.message_main_attachment_id)


        # Case 2: Preserve manually added attachments (not coming from emails)
        self.authenticate("admin", "admin")

        invoice_manual = self.env['account.move'].create({'move_type': 'in_invoice', 'extract_state': 'not_enough_credit'})
        response = self.url_open("/mail/attachment/upload",
            {
                "csrf_token": http.Request.csrf_token(self),
                "thread_id": invoice_manual.id,
                "thread_model": "account.move",
            },
            files={"ufile": b""}, timeout=None
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(invoice_manual.attachment_ids)
