from odoo import fields, models, api, _
import qrcode
import io, base64
from odoo.exceptions import ValidationError
from odoo.addons.l10n_at_pos.tools import at_fiskaly_services

class PosOrder(models.Model):
    _inherit = ['pos.order']

    l10n_at_pos_order_receipt_id = fields.Char(string="Receipt Webhook UUID", readonly=True, copy=False)
    l10n_at_pos_order_receipt_number = fields.Integer(string="Receipt number", readonly=True, copy=False)
    l10n_at_pos_order_receipt_qr_data = fields.Char(string="Receipt qrcode", readonly=True, copy=False)
    is_fiskaly_order_receipt_signed = fields.Boolean(string="Is Receipt Signed", readonly=True, copy=False, default = False)

    def _generate_qr_code_image(self, qr_data):
        qr = qrcode.make(qr_data)
        temp = io.BytesIO()
        qr.save(temp, format="PNG")
        qr_image_base64 = base64.b64encode(temp.getvalue()).decode("utf-8")
        print(qr_image_base64)
        return qr_image_base64

    def fiskaly_receipt_generation(self, session_id, receipt_type = "NORMAL"):
        at_fiskaly_services.sign_order_receipt(self, self._l10n_at_amounts_per_vat(), session_id, receipt_type)
        return (self.is_fiskaly_order_receipt_signed, self.l10n_at_pos_order_receipt_number, self.l10n_at_pos_order_receipt_qr_data)

    def _l10n_at_amounts_per_vat(self):
        """
        Used to retrieve a list of information for the amounts_per_vat key in the dsfinvk json template
        :return: [{amount[int], excl_vat[float], incl_vat[float]}]
        """
        results = []
        # Access the lines related to this order
        for line in self.lines:
            for tax in line.tax_ids:
                # Check if the tax is already in the results list
                existing_entry = next((item for item in results if item['amount'] == tax.amount), None)
                if existing_entry:
                    # Update the existing entry
                    existing_entry['excl_vat'] += line.price_subtotal
                    existing_entry['incl_vat'] += line.price_subtotal_incl
                else:
                    # Create a new entry
                    results.append({
                        'amount': tax.amount,
                        'excl_vat': line.price_subtotal,
                        'incl_vat': line.price_subtotal_incl
                    })
        return results

    def action_queue_receipts_sign(self):
        to_sign_orders = self.filtered(lambda order: not order.is_fiskaly_order_receipt_signed)
        # first again initiate that cash registers
        sessions_tobe_opened = to_sign_orders.mapped('session_id')
        if self.company_id.l10n_at_fiskaly_access_tocken and sessions_tobe_opened:
            # as they only allow one initialized or outage SCU if no open reg -> no scu
            unique_code = at_fiskaly_services.generate_custom_uuidv4()
            if not self.env['pos.session'].search([('state','!=','closed')]):
                # initialized one new SCU as we can't put them as outage while closing due to one concurrent active scu
                at_fiskaly_services._create_scu(self.company_id, unique_code)
                at_fiskaly_services.scu_state_update(self.company_id, 'INITIALIZED', unique_code)
            for session in sessions_tobe_opened:
                at_fiskaly_services.cash_reg_state_update(session, "INITIALIZED")
            for order in to_sign_orders:
                # paid or not
                if order.to_invoice:
                    raise ValidationError(_("Some orders are not paid yet.please pay them and then try to sign receipts"))
                # no partner no sign
                if not order.partner_id:
                    raise ValidationError(_("Some orders doesn't have customer selected"))
                order.fiskaly_receipt_generation(order.session_id.id)
            # check and decommition or outage all the registers
            for session in sessions_tobe_opened:
                sign_failed_orders = self.filtered(lambda o: not o.is_fiskaly_order_receipt_signed)
                new_state = 'DECOMMISSIONED'
                if sign_failed_orders:
                    new_state = 'OUTAGE'
                at_fiskaly_services.cash_reg_state_update(session, new_state)
            # close SCU
            at_fiskaly_services.scu_state_update(self.company_id, 'DECOMMISSIONED', unique_code)
