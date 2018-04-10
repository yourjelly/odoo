# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import uuid

from odoo import http
from odoo.http import request

from odoo.addons.web.controllers.main import CSVExport

class ExportGstr(CSVExport):

    @http.route(['/csv/download/<model("export.gst.return.csv"):gst_return>'], type='http', auth='public')
    def download_gstr_report(self, gst_return, **post):
        return self.base(json.dumps(self.export_data(gst_return.gst_return_type ,gst_return.export_summary, gst_return.month, gst_return.year)), uuid.uuid4().hex)

    def export_data(self, gst_return_type, gst_type, month, year):
        month_and_year = "%s-%s"%(month, year)
        company_ids = request.env.user.company_id.ids + request.env.user.company_id.child_ids.ids
        fields = domain = []
        model = 'account.invoice.gst.report'
        if gst_return_type == 'gstr1':
            gstr1_type_data = self.get_gstr1_type_data(gst_type, model, company_ids, month_and_year)
            model = gstr1_type_data['model']
            fields = gstr1_type_data['fields']
            domain = gstr1_type_data['domain']
        if gst_return_type == 'gstr2':
            gstr2_type_data = self.get_gstr2_type_data(gst_type, model, company_ids, month_and_year)
            model = gstr2_type_data['model']
            fields = gstr2_type_data['fields']
            domain = gstr2_type_data['domain']
        return {'fields': fields, 'import_compat': False, 'domain': domain, 'model': model,'ids': []}

    def get_gstr1_type_data(self, gst_type, model, company_ids, month_and_year):
        #Give model, Fields and domain by gstr1 type data
        #Get value from account settings
        IrConfig = request.env['ir.config_parameter'].sudo()
        b2cs_amount = IrConfig.get_param('l10n_in.l10n_in_b2cs_max') or 250000
        domain = [('company_id', 'in', company_ids), ('invoice_month', '=', str(month_and_year))]
        fields = []
        if gst_type == 'b2b':
            domain += [('place_of_supply', '!=', False), ('type', '=', 'out_invoice'), ('partner_gstn', '!=', False)]
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
                ('b2b_invoice_type', '=', 'regular'),
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
                ('b2b_invoice_type', '=', 'regular'),
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
                ('type', '=', 'out_refund'),
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
                ('type', '=', 'out_refund'),
                ('partner_gstn','=', False)
                ]
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
            domain += [('type', '=', 'out_invoice'), ('exp_invoice_type','in',['wpay','wopay'])]
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
            domain = [('payment_month','=', str(month_and_year)), ('company_id','in', company_ids), ('payment_type','=', 'inbound')]
            fields = [
                {"name": "place_of_supply", "label": "Place Of Supply"},
                {"name": "tax_rate", "label": "Rate"},
                {"name": "amount", "label": "Gross Advance Received"},
                 #{"name": "", "label": "Cess Amount"}
            ]
        if gst_type == 'atadj':
            model = 'account.advances.adjustments.report'
            domain = [('invoice_month', '=', month_and_year), ('company_id','in', company_ids), ('payment_type','=', 'inbound')]
            fields = [
                {"name": "place_of_supply", "label": "Place Of Supply"},
                {"name": "tax_rate", "label": "Rate"},
                {"name": "invoice_payment", "label": "Gross Advance Adjusted"},
                #{"name": "", "label": "Cess Amount"}
            ]
        if gst_type == 'hsn':
            model = 'hsn.gst.report'
            domain = [('invoice_month', '=', month_and_year), ('uom_name', '!=', False), '|', ('hsn_code', '!=', False), ('hsn_description', '!=', False), ('company_id','in', company_ids)]
            fields = [
                {"name": "hsn_code", "label": "HSN"},
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
            domain = [('invoice_month', '=', month_and_year), ('document_type', '!=', False), ('company_id','in', company_ids)]
            fields = [
                      {"name": "document_type", "label": "Nature of Document"},
                      {"name": "num_from", "label": "Sr. No. From"},
                      {"name": "num_to", "label": "Sr. No. To"},
                      {"name": "total_number", "label": "Total Number"},
                      {"name": "cancelled", "label": "Cancelled"},
                     ]

        if gst_type == 'exemp':
            model = 'exempted.gst.report'
            domain = [('invoice_month', '=', month_and_year), ('company_id','in', company_ids), ('type', '=', 'out_invoice')]
            fields = [{"name": "out_supply_type", "label": "Description"},
                      {"name": "nil_rated_amount", "label": "Nil Rated Supplies"},
                      {"name": "exempted_amount", "label": "Exempted(other than nil rated/non GST supply)"},
                      {"name": "non_gst_supplies", "label": "Non-GST Supplies"}
                     ]
        return {'model': model, 'domain': domain, 'fields': fields}

    def get_gstr2_type_data(self, gst_type, model, company_ids, month_and_year):
        #Give model, Fields and domain by gstr2 type data
        domain = [('company_id', 'in', company_ids), ('invoice_month', '=', str(month_and_year))]
        fields = []
        if gst_type == 'b2b':
            domain += [('place_of_supply', '!=', False), ('type', '=', 'in_invoice'), ('partner_gstn', '!=', False)]
            fields = [
                {"name": "partner_gstn", "label": "GSTIN of Supplier"},
                {"name": "invoice_number", "label": "Invoice Number"},
                {"name": "invoice_date", "label": "Invoice date"},
                {"name": "invoice_total", "label": "Invoice Value"},
                {"name": "place_of_supply", "label": "Place Of Supply"},

                {"name": "is_reverse_charge", "label": "Reverse Charge"},
                {"name": "b2b_invoice_type", "label": "Invoice Type"},
                {"name": "tax_rate", "label": "Rate"},
                {"name": "price_total", "label": "Taxable Value"},
                {"name": "igst_amount", "label": "Integrated Tax Paid"},
                {"name": "cgst_amount", "label": "Central Tax Paid"},
                {"name": "sgst_amount", "label": "State/UT Tax Paid"},
                {"name": "cess_amount", "label": "Cess Paid"},
                {"name": "itc_type", "label": "Eligibility For ITC"},
                {"name": "itc_igst_amount", "label": "Availed ITC Integrated Tax"},
                {"name": "itc_cgst_amount", "label": "Availed ITC Central Tax"},
                {"name": "itc_sgst_amount", "label": "Availed ITC State/UT Tax"},
                {"name": "itc_cess_amount", "label": "Availed ITC Cess"}
            ]

        if gst_type == 'b2bur':
            domain += [('place_of_supply', '!=', False), ('type', '=', 'in_invoice'), ('partner_gstn', '=', False)]
            fields = [
                {"name": "partner_name", "label": "Supplier Name"},
                {"name": "invoice_number", "label": "Invoice Number"},
                {"name": "invoice_date", "label": "Invoice date"},
                {"name": "invoice_total", "label": "Invoice Value"},
                {"name": "place_of_supply", "label": "Place Of Supply"},
                {"name": "supply_type", "label": "Supply Type"},
                {"name": "tax_rate", "label": "Rate"},
                {"name": "price_total", "label": "Taxable Value"},
                {"name": "igst_amount", "label": "Integrated Tax Paid"},
                {"name": "cgst_amount", "label": "Central Tax Paid"},
                {"name": "sgst_amount", "label": "State/UT Tax Paid"},
                {"name": "cess_amount", "label": "Cess Paid"},
                {"name": "itc_type", "label": "Eligibility For ITC"},
                {"name": "itc_igst_amount", "label": "Availed ITC Integrated Tax"},
                {"name": "itc_cgst_amount", "label": "Availed ITC Central Tax"},
                {"name": "itc_sgst_amount", "label": "Availed ITC State/UT Tax"},
                {"name": "itc_cess_amount", "label": "Availed ITC Cess"}
            ]

        if gst_type == 'imps':
            domain += [('import_product_type', '=', 'import_of_services'), ('type', '=', 'in_invoice')]
            fields = [
                {"name": "invoice_number", "label": "Invoice Number of Reg Recipient"},
                {"name": "invoice_date", "label": "Invoice Date"},
                {"name": "invoice_total", "label": "Invoice Value"},
                {"name": "place_of_supply", "label": "Place Of Supply"},
                {"name": "tax_rate", "label": "Rate"},
                {"name": "price_total", "label": "Taxable Value"},
                {"name": "igst_amount", "label": "Integrated Tax Paid"},
                {"name": "cess_amount", "label": "Cess Paid"},
                {"name": "itc_type", "label": "Eligibility For ITC"},
                {"name": "itc_igst_amount", "label": "Availed ITC Integrated Tax"},
                {"name": "itc_cess_amount", "label": "Availed ITC Cess"}
            ]

        if gst_type == 'impg':
            domain += [('import_product_type', '=', 'import_of_goods'), ('type', '=', 'in_invoice')]
            fields = [
                {"name": "port_code", "label": "Port Code"},
                {"name": "shipping_bill_number", "label": "Bill Of Entry Number"},
                {"name": "shipping_bill_date", "label": "Bill Of Entry Date"},
                {"name": "invoice_total", "label": "Bill Of Entry Value"},
                {"name": "gst_import_type", "label": "Document type"},
                {"name": "partner_gstn", "label": "GSTIN Of SEZ Supplier"},
                {"name": "tax_rate", "label": "Rate"},
                {"name": "price_total", "label": "Taxable Value"},
                {"name": "igst_amount", "label": "Integrated Tax Paid"},
                {"name": "cess_amount", "label": "Cess Paid"},
                {"name": "itc_type", "label": "Eligibility For ITC"},
                {"name": "itc_igst_amount", "label": "Availed ITC Integrated Tax"},
                {"name": "itc_cess_amount", "label": "Availed ITC Cess"}
            ]

        if gst_type == 'cdnr':
            domain += [('type', '=', 'in_refund'), ('partner_gstn', '!=', False)]
            fields = [
                {"name": "partner_gstn", "label": "GSTIN of Supplier"},
                {"name": "invoice_number", "label": "Note/Refund Voucher Number"},
                {"name": "invoice_date", "label": "Note/Refund Voucher date"},
                {"name": "refund_invoice_number", "label": "Invoice/Advance Payment Voucher Number"},
                {"name": "refund_invoice_date", "label": "Invoice/Advance Payment Voucher date"},
                {"name": "is_pre_gst", "label": "Pre GST"},
                {"name": "refund_document_type", "label": "Document Type"},
                {"name": "refund_reason", "label": "Reason For Issuing document"},
                {"name": "supply_type", "label": "Supply Type"},
                {"name": "invoice_total", "label": "Note/Refund Voucher Value"},
                {"name": "tax_rate", "label": "Rate"},
                {"name": "price_total", "label": "Taxable Value"},
                {"name": "igst_amount", "label": "Integrated Tax Paid"},
                {"name": "cgst_amount", "label": "Central Tax Paid"},
                {"name": "sgst_amount", "label": "State/UT Tax Paid"},
                {"name": "cess_amount", "label": "Cess Paid"},
                {"name": "itc_type", "label": "Eligibility For ITC"},
                {"name": "itc_igst_amount", "label": "Availed ITC Integrated Tax"},
                {"name": "itc_cgst_amount", "label": "Availed ITC Central Tax"},
                {"name": "itc_sgst_amount", "label": "Availed ITC State/UT Tax"},
                {"name": "itc_cess_amount", "label": "Availed ITC Cess"},
            ]
        if gst_type == 'cdnur':
            domain += [('type', '=', 'in_refund'), ('partner_gstn', '=', False)]
            fields = [
                {"name": "invoice_number", "label": "Note/Voucher Number"},
                {"name": "invoice_date", "label": "Note/Voucher date"},
                {"name": "refund_invoice_number", "label": "Invoice/Advance Payment Voucher number"},
                {"name": "refund_invoice_date", "label": "Invoice/Advance Payment Voucher date"},
                {"name": "is_pre_gst", "label": "Pre GST"},
                {"name": "refund_document_type", "label": "Document Type"},
                {"name": "refund_reason", "label": "Reason For Issuing document"},
                {"name": "supply_type", "label": "Supply Type"},
                {"name": "refund_import_type", "label": "Invoice Type"},
                {"name": "invoice_total", "label": "Note/Voucher Value"},
                {"name": "tax_rate", "label": "Rate"},
                {"name": "price_total", "label": "Taxable Value"},
                {"name": "igst_amount", "label": "Integrated Tax Paid"},
                {"name": "cgst_amount", "label": "Central Tax Paid"},
                {"name": "sgst_amount", "label": "State/UT Tax Paid"},
                {"name": "cess_amount", "label": "Cess Paid"},
                {"name": "itc_type", "label": "Eligibility For ITC"},
                {"name": "itc_igst_amount", "label": "Availed ITC Integrated Tax"},
                {"name": "itc_cgst_amount", "label": "Availed ITC Central Tax"},
                {"name": "itc_sgst_amount", "label": "Availed ITC State/UT Tax"},
                {"name": "itc_cess_amount", "label": "Availed ITC Cess"}
            ]

        if gst_type == 'at':
            model = 'account.advances.payment.report'
            domain = [
                ('place_of_supply', '!=', False),
                ('payment_month', '=', str(month_and_year)),
                ('company_id','in', company_ids),
                ('payment_type','=', 'outbound')
                ]
            fields = [
                {"name": "place_of_supply", "label": "Place Of Supply"},
                {"name": "supply_type", "label": "Supply Type"},
                {"name": "amount", "label": "Gross Advance Paid"},
        #        {"name": "", "label": "Cess Amount"}
            ]

        if gst_type == 'atadj':
            model = 'account.advances.adjustments.report'
            domain = [
                ('place_of_supply', '!=', False),
                ('invoice_month', '=', str(month_and_year)),
                ('company_id','in', company_ids),
                ('payment_type','=', 'outbound')
                ]
            fields = [
                {"name": "place_of_supply", "label": "Place Of Supply"},
                {"name": "supply_type", "label": "Supply Type"},
                {"name": "invoice_payment", "label": "Gross Advance Paid to be Adjusted"},
                #{"name": "", "label": "Cess Adjusted"}
            ]

        if gst_type == 'exempt':
            model = 'exempted.gst.report'
            domain = [
                ('invoice_month', '=', month_and_year),
                ('company_id','in', company_ids),
                ('type', '=', 'in_invoice')
                ]
            fields = [
                {"name": "in_supply_type", "label": "Description"},
                {"name": "composition_amount", "label": "Composition taxable person"},
                {"name": "nil_rated_amount", "label": "Nil Rated Supplies"},
                {"name": "exempted_amount", "label": "Exempted (other than nil rated/non GST supply )"},
                {"name": "non_gst_supplies", "label": "Non-GST supplies"}
            ]

        if gst_type == 'hsnsum':
            model = 'hsn.gst.report'
            domain = [
                ('invoice_month', '=', month_and_year),
                ('uom_name', '!=', False), '|', ('hsn_code', '!=', False),
                ('hsn_description', '!=', False),
                ('company_id','in', company_ids), ('type', '=', 'in_invoice')
                ]
            fields = [
                {"name": "hsn_code", "label": "HSN"},
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
        return {'model': model, 'domain': domain, 'fields': fields}
