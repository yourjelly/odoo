# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import traceback

from json import JSONDecodeError, dumps

from odoo import _
from odoo.exceptions import MissingError
from odoo.http import Controller, request, route
from .utils import clean_action

_logger = logging.getLogger(__name__)


class Action(Controller):

    @route('/web/action/load', type='json', auth="user")
    def load(self, action_id, additional_context=None):
        Actions = request.env['ir.actions.actions']
        value = False
        try:
            action_id = int(action_id)
        except ValueError:
            try:
                action = request.env.ref(action_id)
                assert action._name.startswith('ir.actions.')
                action_id = action.id
            except Exception as exc:
                raise MissingError(_("The action %r does not exist.", action_id)) from exc

        base_action = Actions.browse([action_id]).sudo().read(['type'])
        if base_action:
            action_type = base_action[0]['type']
            if action_type == 'ir.actions.report':
                request.update_context(bin_size=True)
            if additional_context:
                request.update_context(**additional_context)
            action = request.env[action_type].sudo().browse([action_id]).read()
            if action:
                value = clean_action(action[0], env=request.env)
        return value

    @route('/web/action/run', type='json', auth="user")
    def run(self, action_id, context=None):
        if context:
            request.update_context(**context)
        action = request.env['ir.actions.server'].browse([action_id])
        result = action.run()
        return clean_action(result, env=action.env) if result else False

    @route(['/web/hook/<string:rule_uuid>'], type='http', auth='none', methods=['GET', 'POST'], csrf=False)
    def call_webhook_http(self, rule_uuid, **kwargs):
        IrActionsServer = request.env["ir.actions.server"]
        action = IrActionsServer.sudo().search([("url_path", "=", rule_uuid), ("expose", "=", "webhook")])
        if not action:
            return request.make_json_response({'status': 'error'}, status=404)

        ir_logging_sudo = request.env['ir.logging'].sudo()
        try:
            action.run()
        except Exception: # noqa: BLE001
            log_msg = "Webhook #%s failed with error:\n%s" % (action.id, traceback.format_exc())
            _logger.warning(log_msg)
            if action.log_webhook_calls:
                ir_logging_sudo.create({
                    'name': _("Webhook Log"),
                    'type': 'server',
                    'dbname': IrActionsServer._cr.dbname,
                    'level': 'ERROR',
                    'message': log_msg,
                    'path': "ir_actions_server(%s)" % action.id,
                    'func': '',
                    'line': ''
                })
            return request.make_json_response({'status': 'error'}, status=500)

        try:
            payload = request.get_json_data()
        except JSONDecodeError:
            payload = request.get_http_params()

        log_msg = "Webhook #%s triggered with payload %s" % (action.id, dumps(payload))
        _logger.info(log_msg)
        if action.log_webhook_calls:
            ir_logging_sudo.create({
                'name': _("Webhook Log"),
                'type': 'server',
                'dbname': IrActionsServer._cr.dbname,
                'level': 'INFO',
                'message': log_msg,
                'path': "ir_actions_server(%s)" % action.id,
                'func': '',
                'line': ''
            })

        return request.make_json_response({'status': 'ok'}, status=200)
