# Part of Odoo. See LICENSE file for full copyright and licensing details.

from werkzeug.exceptions import NotFound

from odoo import http
from odoo.exceptions import UserError
from odoo.http import request
from odoo.tools import consteq
from odoo.addons.mail.models.discuss.mail_guest import add_guest_to_context


class AttachmentController(http.Controller):
    @http.route("/discuss/attachments", methods=["POST"], type="json", auth="public")
    @add_guest_to_context
    def load_attachments(self, channel_id, limit=30, older_attachment_id=None):
        channel_member_sudo = request.env["discuss.channel.member"]._get_as_sudo_from_context_or_raise(channel_id=channel_id)
        domain = [
            ["res_id", "=", channel_id],
            ["res_model", "=", "discuss.channel"],
        ]
        # 20 19 18 17 16 15 -- 14 13 12 11 10 9 -- 8 7 6 5 4 3 -- 2 1
        if older_attachment_id:
            domain.append(["id", "<", older_attachment_id])
        return channel_member_sudo.env["ir.attachment"].search(domain, limit=limit, order="id DESC")._attachment_format()

