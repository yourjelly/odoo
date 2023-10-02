# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from uuid import uuid4
from json import JSONDecodeError
from secrets import compare_digest
import hashlib
from odoo.tools.json import scriptsafe as json_scriptsafe

from odoo.http import request
from odoo import fields, models, api, exceptions, _


class ServerAction(models.Model):
    _inherit = "ir.actions.server"

    url = fields.Char("Public Url", compute="_compute_url")
    url_path = fields.Char("URL Path", help="Additional URL path", compute="_compute_url_path", store=True)
    expose = fields.Selection([("webhook", "Expose as webhook")],
        help="Expose this server action via a controller. The 'as webhook' option will make the server action available via '/web/hook/<url_path>'")

    log_webhook_calls = fields.Boolean(string="Log Calls", default=False)

    @api.constrains("expose", "state")
    def _constrains_state(self):
        for action in self:
            if action.expose == "webhook" and action.state != "code":
                raise exceptions.ValidationError(_("A webhook is necessarily defined as executing python code"))

    @api.depends("state", "expose", "url_path")
    def _compute_url(self):
        for action in self:
            if action.expose == "webhook":
                action.url = f"/web/hook/{action.url_path}"
            else:
                action.url = False

    @api.depends("state", "expose")
    def _compute_url_path(self):
        for action in self:
            if action.expose == "webhook":
                action.url_path = str(uuid4())
            else:
                action.url_path = False

    def _get_eval_context(self, action=None):
        eval_context = super()._get_eval_context(action)
        if action and action.state == "code":
            eval_context.update({
                "request": request,
                "json": json_scriptsafe,
            })

        if action and action.expose == "webhook" and request:
            try:
                payload = request.get_json_data()
            except JSONDecodeError:
                payload = request.get_http_params()

            def _compare_digest(a, b):
                if not compare_digest(a, b):
                    raise exceptions.UserError(_("Secrets not matching"))
            eval_context.update({
                "payload": payload,
                "compare_digest": _compare_digest,
                "sha256": hashlib.sha256,
            })

        return eval_context

    def action_rotate_url(self):
        self._compute_url_path()

    def action_view_webhook_logs(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Webhook Logs'),
            'res_model': 'ir.logging',
            'view_mode': 'tree,form',
            'domain': [('path', '=', "ir_actions_server(%s)" % self.id)],
        }


