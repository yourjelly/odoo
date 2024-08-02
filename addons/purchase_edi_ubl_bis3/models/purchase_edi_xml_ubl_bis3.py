from lxml import etree
from typing import NamedTuple

from odoo import models, _
from odoo.tools import html2plaintext, cleanup_xml_node


class LineAdapter(NamedTuple):
    """
    This named tuple was introduced to make _get_uom_unece_code() compatible with purchase order lines
    TODO: remove it when we fix the signature of _get_uom_unece_code() to accept uom instead of line
    """
    product_uom_id: models.Model


class PurchaseEdiXmlUBLBIS3(models.AbstractModel):
    _name = "purchase.edi.xml.ubl_bis3"
    _inherit = "account.edi.xml.ubl_bis3"
    _description = "UBL BIS 3 Peppol Order transaction 3.4"

    # -------------------------------------------------------------------------
    # EXPORT
    # -------------------------------------------------------------------------

    def _export_purchase_order_filename(self, purchase_order):
        return f"{purchase_order.name.replace('/', '_')}_ubl_bis3.xml"

    def _get_delivery_party_vals(self, delivery):
        return [{
            'actual_delivery_date': None,
            'delivery_location_vals': {
                'delivery_address_vals': self._get_partner_address_vals(delivery),
            },
        }]

    def _export_order_vals(self, order):
        order_lines = self._get_order_lines(order)
        anticipated_monetary_total_vals = self._get_anticipated_monetary_total_vals(order, order_lines)

        supplier = order.partner_id
        customer = order.company_id.partner_id.commercial_partner_id
        customer_delivery_address = customer.child_ids.filtered(lambda child: child.type == 'delivery')
        delivery = (
            order.dest_address_id
            or (customer_delivery_address and customer_delivery_address[0])
            or customer
        )

        vals = {
            'builder': self,
            'order': order,
            'supplier': supplier,
            'customer': customer,

            'format_float': self.env['account.edi.common'].format_float,
            'AddressType_template': 'account_edi_ubl_cii.ubl_21_AddressType',
            'PartyType_template': 'account_edi_ubl_cii.ubl_21_PartyType',
            'ContactType_template': 'account_edi_ubl_cii.ubl_20_ContactType',
            'TaxCategoryType_template': 'account_edi_ubl_cii.ubl_20_TaxCategoryType',
            'TaxTotalType_template': 'account_edi_ubl_cii.ubl_20_TaxTotalType',
            'AllowanceChargeType_template': 'account_edi_ubl_cii.ubl_20_AllowanceChargeType',
            'SignatureType_template': 'account_edi_ubl_cii.ubl_20_SignatureType',
            'ResponseType_template': 'account_edi_ubl_cii.ubl_20_ResponseType',
            'DeliveryType_template': 'account_edi_ubl_cii.ubl_20_DeliveryType',
            'InvoicePeriodType_template': 'account_edi_ubl_cii.ubl_20_InvoicePeriodType',
            'MonetaryTotalType_template': 'account_edi_ubl_cii.ubl_20_MonetaryTotalType',

            'vals': {
                'id': order.partner_ref or order.name,
                'issue_date': order.create_date.date(),
                'note': html2plaintext(order.notes) if order.notes else False,
                'order_reference': order.partner_ref or order.name,
                'document_currency_code': order.currency_id.name.upper(),
                'delivery_party_vals': self._get_delivery_party_vals(delivery),
                'supplier_party_vals': self._get_partner_party_vals(supplier, role='supplier'),
                'customer_party_vals': self._get_partner_party_vals(customer, role='customer'),
                'payment_terms_vals': self._get_payment_terms_vals(order.payment_term_id),
                # allowances at the document level, the allowances on order lines (eg. discount) are on line_vals
                'anticipated_monetary_total_vals': anticipated_monetary_total_vals,
                'allowance_charge_vals': self._get_order_allowance_charge_vals(order, order_lines),
                'tax_amount': order.amount_tax,
                'order_lines': order_lines,
                'currency_dp': self.env['account.edi.common']._get_currency_decimal_places(order.currency_id),  # currency decimal places
                'currency_id': order.currency_id.name,
            },
        }

        return vals

    def _export_order(self, order):
        vals = self._export_order_vals(order)
        xml_content = self.env['ir.qweb']._render('purchase_edi_ubl_bis3.bis3_OrderType', vals)
        return etree.tostring(cleanup_xml_node(xml_content), xml_declaration=True, encoding='UTF-8')
