# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json
import logging
import requests

from odoo import fields, models, api, _
from odoo.exceptions import AccessError, UserError

_logger = logging.getLogger(__name__)
TIMEOUT = 10

class PosPaymentMethod(models.Model):
    _inherit = 'pos.payment.method'

    mp_bearer_token = fields.Char(string="Production user token", help='Mercado Pago customer production user token: https://www.mercadopago.com.mx/developers/en/reference')
    mp_webhook_secret_key = fields.Char(string="Production secret key", help='Mercado Pago production secret key from integration application: https://www.mercadopago.com.mx/developers/panel/app')

    mp_last_payment_intend = fields.Json()

    mp_smart_point_ids = fields.Many2one("pos.terminal", string="Terminal S/N", \
        help="Given by Mercado Pago on connection, check correspondance with the serial number written on the device")
    point_smart_op_mode = fields.Selection(
        related='mp_smart_point_ids.point_smart_op_mode',
        string='Operating mode',
        help="""To function properly with the Odoo system, the operating mode must be point of sale.
        Warning: For a given terminal, when you change the store or the point of sale from your Mercado Pago account,
        the terminal automatically restore its mode to Standalone""",
        readonly=False)
    id_point_smart_store = fields.Char(
        related='mp_smart_point_ids.id_point_smart_store',
        string='Store ID',
        readonly=True)
    id_point_smart_pos = fields.Char(
        related='mp_smart_point_ids.id_point_smart_pos',
        string='POS ID',
        readonly=True)
    point_smart_store = fields.Text(
        related='mp_smart_point_ids.point_smart_store',
        string='Store',
        help="Set the store on your Mercado Pago account",
        readonly=True)
    point_smart_pos = fields.Text(
        related='mp_smart_point_ids.point_smart_pos',
        string='Point of sale',
        help="Set the point of sale on your Mercado Pago account",
        readonly=True)

    def _get_payment_terminal_selection(self):
        return super()._get_payment_terminal_selection() + [('mercado_pago', 'Mercado Pago')]

    def _is_write_forbidden(self, fields):
        """ Allow the modification of these fields even if a pos_session is open """
        whitelisted_fields = {'mp_last_payment_intend'}
        return bool(fields - whitelisted_fields and self.open_session_ids)

    @api.onchange('point_smart_op_mode')
    def _onchange_point_smart_op_mode(self):
        """
        Triggered when user change the terminal mode
        """

        # Avoid triggering at the creation
        if self.use_payment_terminal != 'mercado_pago' or not self.mp_smart_point_ids.id_point_smart:
            return
        _logger.info('terminal mode changed')
        # User has changed the operatrion mode, translate the selection choosen and
        # send a request to change the mode to Mercado Pago
        mode = {"operating_mode": "STANDALONE" if self.point_smart_op_mode == "standalone" else "PDV"}
        # Whatever the Mercado Response...
        self._call_mp("patch", f"/point/integration-api/devices/{self.mp_smart_point_ids.id_point_smart}", mode)
        # ... we alert the user for consequence of the change
        return {
            'warning': {
                'title': _("Warning"),
                'message': _("Terminal in standalone mode will not work with the Odoo system")
                        if self.point_smart_op_mode == 'standalone'
                        # "cash register" = "Caja" in the Mercado Pago terminal
                        else _("On the terminal, close and reopen the cash register to apply the change"),
            }
        }

    def _call_mp(self, action: str, api_endpoint: str, json_data: json):
        """
        Mercado Pago request stuff
        action: values used [get][post][patch][delete]
        api_endpoint: url endpoint without root
        json_data: data to send to the endpoint
        """

        session = requests.Session()
        session.mount('https://', requests.adapters.HTTPAdapter(max_retries=requests.adapters.Retry(
            total=6,
            backoff_factor=2,
            status_forcelist=[202, 500, 502, 503, 504],
        )))
        session.headers.update({'Authorization': f"Bearer {self.mp_bearer_token}"})
        try:
            ep = 'https://api.mercadopago.com' + api_endpoint
            resp = session.request(action, ep, json=json_data, timeout=TIMEOUT)
            return json.loads(resp.content)
        except requests.exceptions.RequestException as e:
            return {'error': ("There are some issues between us and Mercado Pago, try again later.%s", e)}

    def mp_payment_intent_create(self, infos):
        """
        Called from frontend for creating a payment intent in Mercado Pago
        """

        if not self.env.user.has_group('point_of_sale.group_pos_user'):
            raise AccessError(_("Do not have access to fetch token from Mercado Pago"))

        # Call Mercado Pago for payment intend creation
        resp = self._call_mp("post", f"/point/integration-api/devices/{self.mp_smart_point_ids.id_point_smart}/payment-intents", infos)
        _logger.info("mp_payment_intent_create(), response from Mercado Pago: %s", resp)
        return resp

    def mp_payment_intent_get(self, payment_intent_id):
        """
        Called from frontend to get the last payment intend from Mercado Pago
        """

        if not self.env.user.has_group('point_of_sale.group_pos_user'):
            raise AccessError(_("Do not have access to fetch token from Mercado Pago"))

        # Call Mercado Pago for payment intend status
        # resp = self._call_mp("get", f"/point/integration-api/payment-intents/{payment_intent_id}", {})
        _logger.info("mp_payment_intent_get(), mp_last_payment_intend: %s", self.mp_last_payment_intend)
        return self.mp_last_payment_intend

    def mp_payment_intent_cancel(self, payment_intent_id):
        """
        Called from frontend to cancel a payment intent in Mercado Pago
        """

        if not self.env.user.has_group('point_of_sale.group_pos_user'):
            raise AccessError(_("Do not have access to fetch token from Mercado Pago"))

        # Call Mercado Pago for payment intend cancelation
        resp = self._call_mp("delete", f"/point/integration-api/devices/{self.mp_smart_point_ids.id_point_smart}/payment-intents/{payment_intent_id}", {})
        _logger.info("mp_payment_intent_cancel(), response from Mercado Pago: %s", resp)
        return resp

    def action_connect_refresh(self):
        """
        Triggered when user push the Connection / Refresh button
        """

        data = self._call_mp("get", "/point/integration-api/devices", {})
        if 'devices' in data:
            devices = data["devices"]
            for device in devices:
                id_point_smart = device.get('id')
                point_smart_op_mode = device.get('operating_mode')
                id_point_smart_store = device.get('store_id')
                id_point_smart_pos = device.get('pos_id')
                point_smart_store = "No store attributed\n"
                point_smart_pos = "No point of sale attributed\n"

                if id_point_smart:
                    if id_point_smart_store:
                        data = self._call_mp("get", f"/stores/{id_point_smart_store}", {})
                        store_name = data.get('name', "")
                        store_address = data.get('location', {}).get('address_line', "")
                        if store_name and store_address:
                            point_smart_store = f"Name: {store_name} (id={id_point_smart_store})\nAddress: {store_address}"

                    if id_point_smart_pos:
                        data = self._call_mp("get", f"/pos/{id_point_smart_pos}", {})
                        pos_name = data.get('name', "")
                        pos_status = data.get('status', "")
                        if pos_name and pos_status:
                            point_smart_pos = f"Name: {pos_name} (id={id_point_smart_pos})\nStatus: {pos_status}"

                vals = {
                    'id_point_smart': id_point_smart,
                    'point_smart_op_mode': point_smart_op_mode,
                    'id_point_smart_store': id_point_smart_store,
                    'id_point_smart_pos': id_point_smart_pos,
                    'point_smart_store': point_smart_store or "No store attributed\n",
                    'point_smart_pos': point_smart_pos or "No point of sale attributed\n",
                }

                terminal_record = self.env['pos.terminal'].search([('id_point_smart', '=', id_point_smart)], limit=1)
                if not terminal_record:
                    self.env['pos.terminal'].create(vals)
                else:
                    terminal_record.write(vals)

                self.mp_smart_point_ids = terminal_record.id
        else:
            raise UserError("Please verify your production user token as it was rejected")
