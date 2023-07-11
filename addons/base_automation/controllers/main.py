from odoo.http import request, route, Controller

from json import JSONDecodeError

class BaseAutomationController(Controller):

    @route(['/web/hook/<string:rule_uuid>'], type='http', auth='none', methods=['GET', 'POST'], csrf=False)
    def call_webhook_http(self, rule_uuid, **kwargs):
        """ Execute an automation webhook """
        rule = request.env['base.automation'].sudo().search([('webhook_uuid', '=', rule_uuid)])
        try:
            data = request.get_json_data()
            print(data)
        except JSONDecodeError:
            data = kwargs or {}
        if not rule:
            return request.make_json_response({'status': 'error'}, status=404)
        try:
            rule._execute_webhook(data)
        except Exception:
            return request.make_json_response({'status': 'error'}, status=500)
        return request.make_json_response({'status': 'ok'}, status=200)