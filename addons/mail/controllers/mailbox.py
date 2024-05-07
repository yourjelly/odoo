# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.http import request
from odoo.addons.mail.tools.search_params_to_domain import search_params_to_domain

class MailboxController(http.Controller):
    @http.route("/mail/inbox/messages", methods=["POST"], type="json", auth="user")
    def discuss_inbox_messages(self, search_term=None, before=None, after=None, limit=30, around=None, search_params={}):
        partner_id = request.env.user.partner_id.id
        domain = [("needaction", "=", True)]
        domain.extend(search_params_to_domain(search_params))
        res = request.env["mail.message"]._message_fetch(domain, search_term=search_term, before=before, after=after, around=around, limit=limit)
        return {**res, "messages": res["messages"]._message_format_personalize(partner_id)}

    @http.route("/mail/history/messages", methods=["POST"], type="json", auth="user")
    def discuss_history_messages(self, search_term=None, before=None, after=None, limit=30, around=None, search_params={}):
        domain = [("needaction", "=", False)]
        domain.extend(search_params_to_domain(search_params))
        res = request.env["mail.message"]._message_fetch(domain, search_term=search_term, before=before, after=after, around=around, limit=limit)
        return {**res, "messages": res["messages"]._message_format(for_current_user=True)}

    @http.route("/mail/starred/messages", methods=["POST"], type="json", auth="user")
    def discuss_starred_messages(self, search_term=None, before=None, after=None, limit=30, around=None, search_params={}):
        domain = [("starred_partner_ids", "in", [request.env.user.partner_id.id])]
        domain.extend(search_params_to_domain(search_params))
        res = request.env["mail.message"]._message_fetch(domain, search_term=search_term, before=before, after=after, around=around, limit=limit)
        return {**res, "messages": res["messages"]._message_format(for_current_user=True)}
