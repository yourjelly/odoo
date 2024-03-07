import logging

from odoo import fields, models, _
from odoo.exceptions import AccessError, UserError

from .mercado_pago_pos_request import MercadoPagoPosRequest

_logger = logging.getLogger(__name__)


class PosPaymentMethod(models.Model):
    _inherit = 'pos.payment.method'

    mp_bearer_token = fields.Char(
        string="Production user token",
        help='Mercado Pago customer production user token: https://www.mercadopago.com.mx/developers/en/reference')
    mp_webhook_secret_key = fields.Char(
        string="Production secret key",
        help='Mercado Pago production secret key from integration application: https://www.mercadopago.com.mx/developers/panel/app')
    mp_id_point_smart = fields.Char(
        string="Terminal S/N",
        help="Enter your Point Smart terminal serial number written on the back of your terminal (after the S/N:)")

    def _get_payment_terminal_selection(self):
        return super()._get_payment_terminal_selection() + [('mercado_pago', 'Mercado Pago')]

    def force_pdv(self):
        """
        Triggered in debug mode when the user wants to force the "PDV" mode.
        It calls the Mercado Pago API to set the terminal mode to "PDV".
        """
        if not self.env.user.has_group('point_of_sale.group_pos_user'):
            raise AccessError(_("Do not have access to fetch token from Mercado Pago"))

        mercado_pago = MercadoPagoPosRequest(self.mp_bearer_token)
        _logger.info('Calling Mercado Pago to force the terminal mode to "PDV"')

        mode = {"operating_mode": "PDV"}
        resp = mercado_pago._call_mercado_pago("patch", f"/point/integration-api/devices/{self.mp_id_point_smart}", mode)
        if resp.get("operating_mode") != "PDV":
            raise UserError(f"Unexpected Mercado Pago response: {resp}")
        _logger.info("Successfully set the terminal mode to 'PDV'.")
        return None

    def mp_payment_intent_create(self, infos):
        """
        Called from frontend for creating a payment intent in Mercado Pago
        """
        if not self.env.user.has_group('point_of_sale.group_pos_user'):
            raise AccessError(_("Do not have access to fetch token from Mercado Pago"))

        mercado_pago = MercadoPagoPosRequest(self.mp_bearer_token)
        # Call Mercado Pago for payment intend creation
        resp = mercado_pago._call_mercado_pago("post", f"/point/integration-api/devices/{self.mp_id_point_smart}/payment-intents", infos)
        _logger.info("mp_payment_intent_create(), response from Mercado Pago: %s", resp)
        return resp

    def mp_payment_intent_get(self, payment_intent_id):
        """
        Called from frontend to get the last payment intend from Mercado Pago
        """
        if not self.env.user.has_group('point_of_sale.group_pos_user'):
            raise AccessError(_("Do not have access to fetch token from Mercado Pago"))

        mercado_pago = MercadoPagoPosRequest(self.mp_bearer_token)
        # Call Mercado Pago for payment intend status
        resp = mercado_pago._call_mercado_pago("get", f"/point/integration-api/payment-intents/{payment_intent_id}", {})
        _logger.info("mp_payment_intent_get(), response from Mercado Pago: %s", resp)
        return resp

    def mp_payment_intent_cancel(self, payment_intent_id):
        """
        Called from frontend to cancel a payment intent in Mercado Pago
        """
        if not self.env.user.has_group('point_of_sale.group_pos_user'):
            raise AccessError(_("Do not have access to fetch token from Mercado Pago"))

        mercado_pago = MercadoPagoPosRequest(self.mp_bearer_token)
        # Call Mercado Pago for payment intend cancelation
        resp = mercado_pago._call_mercado_pago("delete", f"/point/integration-api/devices/{self.mp_id_point_smart}/payment-intents/{payment_intent_id}", {})
        _logger.info("mp_payment_intent_cancel(), response from Mercado Pago: %s", resp)
        return resp

    def _find_terminal(self, vals):
        mercado_pago = MercadoPagoPosRequest(vals['mp_bearer_token'])
        data = mercado_pago._call_mercado_pago("get", "/point/integration-api/devices", {})
        if 'devices' in data:
            # Search for a device id that contains the serial number entered by the user
            found_device = next((device for device in data['devices'] if vals['mp_id_point_smart'] in device.get('id')), None)

            if not found_device:
                raise UserError("The terminal serial number is not registered on Mercado Pago")

            vals['mp_id_point_smart'] = found_device.get('id', '')
        else:
            raise UserError("Please verify your production user token as it was rejected")

    def write(self, vals):
        vals = vals[0] if isinstance(vals, list) else vals
        vals['mp_bearer_token'] = vals.get('mp_bearer_token', self.mp_bearer_token)
        vals['mp_webhook_secret_key'] = vals.get('mp_webhook_secret_key', self.mp_webhook_secret_key)
        vals['mp_id_point_smart'] = vals.get('mp_id_point_smart', self.mp_id_point_smart)
        self._find_terminal(vals)
        return super().write(vals)

    def create(self, vals):
        vals = vals[0] if isinstance(vals, list) else vals
        self._find_terminal(vals)
        return super().create(vals)
