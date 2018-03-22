# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import uuid

from odoo import http, _
from odoo.http import request

from odoo.addons.web.controllers.main import CSVExport

class ExportGstr(CSVExport):

    @http.route(['/csv/download/<model("export.gst.return.csv"):gst_return>'], type='http', auth='public')
    def download_gstr_report(self, gst_return, **post):
        return self.base(json.dumps(self.export_data(gst_return.export_summary, gst_return.month, gst_return.year)), uuid.uuid4().hex)

    def export_data(self, gst_type, month, year):
        month_and_year = "%s-%s"%(month, year)
        fields = []
        domain = [('invoice_month', '=', str(month_and_year)), ('tax_group_id', 'in', self.gst_group_ids())]
        #Get value from account settings
        b2cs_amount = 250000
        model = 'account.invoice.gst.report'
        if gst_type == 'b2b':
            domain += [('place_of_supply', '!=', False), ('type', '=', 'out_invoice'), ('partner_gstn','!=', False)]
            fields = [
                {"name": "partner_gstn", "label": "GSTIN/UIN of Recipient"},
                {"name": "partner_name", "label": "Receiver Name"},
                {"name": "invoice_number", "label": "Invoice Number"},
                {"name": "invoice_date", "label": "Invoice date"},
                {"name": "invoice_total", "label": "Invoice Value"},
                {"name": "place_of_supply", "label": "Place Of Supply"},
                {"name": "is_reverse_charge", "label": "Reverse Charge"},
                {"name": "b2b_invoice_type", "label": "Invoice Type"},
                {"name": "ecommerce_gstn", "label": "E-Commerce GSTIN"},
                {"name": "tax_rate", "label": "Rate"},
                {"name": "price_total", "label": "Taxable Value"},
                {"name": "cess_amount", "label": "Cess Amount"}
            ]
        if gst_type == 'b2cl':
            domain += [
                ('place_of_supply', '!=', False),
                ('b2b_invoice_type', '=', 'R'),
                ('invoice_total', '>', b2cs_amount),
                ('type', '=', 'out_invoice'),
                ('partner_gstn','=', False)]
            fields = [
                {"name": "invoice_number", "label": "Invoice Number"},
                {"name": "invoice_date", "label": "Invoice date"},
                {"name": "invoice_total", "label": "Invoice Value"},
                {"name": "place_of_supply", "label": "Place Of Supply"},
                {"name": "tax_rate", "label": "Rate"},
                {"name": "price_total", "label": "Taxable Value"},
                {"name": "cess_amount", "label": "Cess Amount"},
                {"name": "ecommerce_gstn", "label": "E-Commerce GSTIN"}
            ]
        if gst_type == 'b2cs':
            domain += [
                ('place_of_supply', '!=', False),
                ('b2b_invoice_type', '=', 'R'),
                ('invoice_total', '<', b2cs_amount),
                ('type', '=', 'out_invoice'),
                ('partner_gstn','=', False)]
            fields = [
                {"name": "is_ecommerce", "label": "Type"},
                {"name": "place_of_supply", "label": "Place Of Supply"},
                {"name": "tax_rate", "label": "Rate"},
                {"name": "price_total", "label": "Taxable Value"},
                {"name": "cess_amount", "label": "Cess Amount"},
                {"name": "ecommerce_gstn", "label": "E-Commerce GSTIN"}
            ]
        if gst_type == 'cdnr':
            domain += [
                ('place_of_supply', '!=', False),
                ('type', 'in', ['out_refund','in_refund']),
                ('partner_gstn', '!=', False)]
            fields = [
                {"name": "partner_gstn", "label": "GSTIN/UIN of Recipient"},
                {"name": "partner_name", "label": "Receiver Name"},
                {"name": "refund_invoice_number", "label": "Invoice/Advance Receipt Number"},
                {"name": "refund_invoice_date", "label": "Invoice/Advance Receipt date"},
                {"name": "invoice_number", "label": "Note/Refund Voucher Number"},
                {"name": "invoice_date", "label": "Note/Refund Voucher date"},
                {"name": "refund_document_type", "label": "Document Type"},
                {"name": "refund_reason", "label": "Reason For Issuing document"},
                {"name": "place_of_supply", "label": "Place Of Supply"},
                {"name": "invoice_total", "label": "Note/Refund Voucher Value"},
                {"name": "tax_rate", "label": "Rate"},
                {"name": "price_total", "label": "Taxable Value"},
                {"name": "cess_amount", "label": "Cess Amount"},
                {"name": "is_pre_gst", "label": "Pre GST"}
            ]
        if gst_type == 'cdnur':
            domain += [
                ('place_of_supply', '!=', False),
                ('type', 'in', ['out_refund', 'in_refund']),
                ('partner_gstn','=', False)]
            fields = [
                {"name": "refund_invoice_type", "label": "UR Type"},
                {"name": "invoice_number", "label": "Note/Refund Voucher Number"},
                {"name": "invoice_date", "label": "Note/Refund Voucher date"},
                {"name": "refund_document_type", "label": "Document Type"},
                {"name": "refund_invoice_number", "label": "Invoice/Advance Receipt Number"},
                {"name": "refund_invoice_date", "label": "Invoice/Advance Receipt date"},
                {"name": "refund_reason", "label": "Reason For Issuing document"},
                {"name": "place_of_supply", "label": "Place Of Supply"},
                {"name": "invoice_total", "label": "Note/Refund Voucher Value"},
                {"name": "tax_rate", "label": "Rate"},
                {"name": "price_total", "label": "Taxable Value"},
                {"name": "cess_amount", "label": "Cess Amount"},
                {"name": "is_pre_gst", "label": "Pre GST"}
            ]
        if gst_type == 'exp':
            domain += [('type', '=', 'out_invoice'), ('exp_invoice_type','in',['WPAY','WOPAY'])]
            fields = [
                {"name": "exp_invoice_type", "label": "Export Type"},
                {"name": "invoice_number", "label": "Invoice Number"},
                {"name": "invoice_date", "label": "Invoice date"},
                {"name": "invoice_total", "label": "Invoice Value"},
                {"name": "port_code", "label": "Port Code"},
                {"name": "shipping_bill_number", "label": "Shipping Bill Number"}, #is pending
                {"name": "shipping_bill_date", "label": "Shipping Bill Date"}, #is pending
                {"name": "tax_rate", "label": "Rate"},
                {"name": "price_total", "label": "Taxable Value"}
            ]
        if gst_type == 'at':
            model = 'account.advances.payment.report'
            domain = [
                ('payment_month','=', str(month_and_year)),
                ('amount', '>', 0),
                ('internal_type', '=', 'receivable')]
            fields = [
                {"name": "place_of_supply", "label": "Place Of Supply"},
                {"name": "tax_rate", "label": "Rate"},
                {"name": "amount", "label": "Gross Advance Received"},
                 #{"name": "", "label": "Cess Amount"}
            ]
        if gst_type == 'atadj':
            model = 'account.advances.adjustments.report'
            domain = [
                ('place_of_supply','!=',False),
                ('invoice_month', '=', month_and_year),
                ('invoice_payment', '>', 0),
                ('internal_type', '=', 'receivable')]
            fields = [
                {"name": "place_of_supply", "label": "Place Of Supply"},
                {"name": "tax_rate", "label": "Rate"},
                {"name": "invoice_payment", "label": "Gross Advance Adjusted"},
                #{"name": "", "label": "Cess Amount"}
            ]
        if gst_type == 'hsn':
            model = 'hsn.gst.report'
            domain = [('invoice_month', '=', month_and_year), ('uom_name', '!=', False), '|', ('hsn_code', '!=', False), ('hsn_description', '!=', False)]
            fields = [{"name": "hsn_code", "label": "HSN"},
                      {"name": "hsn_description", "label": "Description"},
                      {"name": "uom_name", "label": "UQC"},
                      {"name": "product_qty", "label": "Total Quantity"},
                      {"name": "invoice_total", "label": "Total Value"},
                      {"name": "price_total", "label": "Taxable Value"},
                      {"name": "igst_amount", "label": "Integrated Tax Amount"},
                      {"name": "cgst_amount", "label": "Central Tax Amount"},
                      {"name": "sgst_amount", "label": "State/UT Tax Amount"},
                      {"name": "cess_amount", "label": "Cess Amount"}
                    ]

        if gst_type == 'docs':
            model = 'docs.gst.report'
            domain = [('invoice_month', '=', month_and_year), ('document_type', '!=', False)]
            fields = [
                      {"name": "document_type", "label": "Nature of Document"},
                      {"name": "num_from", "label": "Sr. No. From"},
                      {"name": "num_to", "label": "Sr. No. To"},
                      {"name": "total_number", "label": "Total Number"},
                      {"name": "cancelled", "label": "Cancelled"},
                     ]

        if gst_type == 'exemp':
            model = 'exempted.gst.report'
            domain = [('invoice_month', '=', month_and_year)]
            fields = [{"name": "type_of_supply", "label": "Description"},
                      {"name": "nil_rated_amount", "label": "Nil Rated Supplies"},
                      {"name": "exempted_amount", "label": "Exempted(other than nil rated/non GST supply)"},
                      {"name": "non_gst_supplies", "label": "Non-GST Supplies"}
                     ]
        return {'fields': fields, 'import_compat': False, 'domain': domain, 'model': model,'ids': []}

    def gst_group_ids(self):
        sgst_group = request.env.ref('l10n_in_export_gstr.sgst_group', False)
        cgst_group = request.env.ref('l10n_in_export_gstr.cgst_group', False)
        igst_group = request.env.ref('l10n_in_export_gstr.igst_group', False)
        return [sgst_group and sgst_group.id or 0, cgst_group and cgst_group.id or 0, igst_group and igst_group.id or 0]
