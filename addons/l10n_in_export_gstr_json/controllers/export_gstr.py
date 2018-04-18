# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
from itertools import groupby
from datetime import datetime

from odoo import http
from odoo.http import request

from odoo.addons.web.controllers.main import content_disposition
from odoo.addons.l10n_in_export_gstr.controllers.export_gstr import ExportGstr

GSTR_RETURN_SECTIONS = ['b2b', 'b2cl', 'b2cs', 'cdnr', 'cdnur', 'exp', 'at', 'atadj', 'exemp', 'hsn', 'docs']

class ExportGstrJson(ExportGstr):

    @http.route(['/json/download/<model("export.gst.return"):gst_return>'], type= 'http', auth= 'public')
    def download_gstr_json(self, gst_return, **post):
        return http.request.make_response(self.prepare_gstr_json(gst_return),
            headers=[('Content-Disposition',
                            content_disposition("%s-%s-%s.json"%(gst_return.gst_return_type, gst_return.month, gst_return.year))),
                     ('Content-Type', 'application/json')],
            cookies={'fileToken': bytearray()})

    def prepare_gstr_json(self, gst_return):
        json_data = {
            "gstin": request.env.user.company_id.vat,
            "fp": "%s%s"%(gst_return.month, gst_return.year),
            "gt": gst_return.gross_turnover,
            "cur_gt": gst_return.cur_gross_turnover,
            "version": "GST1.2",
            "hash": "GSTR1-Hash-Code",
            "mode": "of"
            }
        for gstr_return_section in GSTR_RETURN_SECTIONS:
            summary_type_json = []
            export_data = self.export_data(gst_return.gst_return_type, gstr_return_section, gst_return.month, gst_return.year)
            model = export_data['model']
            domain = export_data['domain']
            read_datas = request.env[model].search_read(domain)
            if gstr_return_section == 'b2b':
                for partner_gstn, values in groupby(sorted(read_datas, key= lambda k: k['partner_gstn']), lambda x: x['partner_gstn']):
                    invoice_datas=[]
                    for invoice_number, invoices in groupby(sorted(list(values), key=lambda k: k['invoice_number']),lambda x: x['invoice_number']):
                        data_keys = ['inum', 'idt', 'val', 'pos', 'rchrg', 'etin', 'inv_typ', 'itms']
                        invoice_datas.append(self.set_values(data_keys, list(invoices), gstr_return_section))
                    summary_type_json.append({'ctin': partner_gstn, 'inv': invoice_datas})

            elif gstr_return_section == 'b2cl':
                for place_of_supply, values in groupby(sorted(read_datas, key= lambda k: k['place_of_supply']), lambda x: x['place_of_supply']):
                    invoice_datas=[]
                    for invoice_number, invoices in groupby(sorted(list(values), key=lambda k: k['invoice_number']),lambda x: x['invoice_number']):
                        data_keys =  ['inum', 'idt', 'val', 'etin', 'itms']
                        invoice_datas.append(self.set_values(data_keys, list(invoices), gstr_return_section))
                    summary_type_json.append({'pos': place_of_supply, 'inv': invoice_datas})

            elif gstr_return_section == 'b2cs':
                for invoices in read_datas:
                    data_keys =  ['sply_ty', 'txval', 'typ', 'etin', 'pos', 'rt', 'iamt', 'camt', 'samt', 'csamt']
                    summary_type_json.append(self.set_values(data_keys, [invoices], gstr_return_section))

            elif gstr_return_section == 'exp':
                for exp_invoice_type, values in groupby(sorted(read_datas, key= lambda k: k['exp_invoice_type']),lambda x: x['exp_invoice_type']):
                    invoice_datas = []
                    for invoice_number, invoices in groupby(sorted(list(values), key= lambda k: k['invoice_number']), lambda x: x['invoice_number']):
                        data_keys =  ['inum', 'idt', 'val', 'sbpcode', 'sbnum', 'sbdt', 'itms']
                        invoice_datas.append(self.set_values(data_keys, list(invoices), gstr_return_section))
                    summary_type_json.append({'exp_typ': exp_invoice_type, 'inv': invoice_datas})

            elif gstr_return_section == 'cdnr':
                for partner_gstn, values in groupby(sorted(read_datas, key= lambda k: k['partner_gstn']), lambda x: x['partner_gstn']):
                    invoice_datas=[]
                    for invoice_number, invoices in groupby(sorted(list(values), key= lambda k: k['invoice_number']), lambda x: x['invoice_number']):
                        data_keys = ['ntty', 'nt_num', 'nt_dt', 'rsn', 'p_gst', 'inum', 'idt', 'val', 'itms']
                        invoice_datas.append(self.set_values(data_keys, list(invoices), gstr_return_section))
                    summary_type_json.append({'ctin': partner_gstn, 'inv': invoice_datas})

            elif gstr_return_section == 'cdnur':
                for invoices in read_datas:
                    data_keys = ['typ', 'ntty', 'nt_num', 'nt_dt', 'rsn', 'p_gst', 'inum', 'idt', 'val', 'itms']
                    summary_type_json.append(self.set_values(data_keys, [invoices], gstr_return_section))

            elif gstr_return_section in ['at', 'atadj']:
                for place_of_supply, values in groupby(sorted(read_datas, key= lambda k: k['place_of_supply']), lambda x: x['place_of_supply']):
                    invoices = list(values)
                    data_keys =  ['rt', 'ad_amt', 'iamt', 'camt', 'samt'] #csamt TODO
                    summary_type_json.append({'pos': place_of_supply[:2], 'sply_ty': invoices and invoices[0].get('supply_type') or '', 'inv': self.set_values(data_keys, invoices, gstr_return_section)})

            elif gstr_return_section == 'exemp':
                gstr_return_section = 'nill'
                invoice_datas=[]
                for exempted in read_datas:
                    data_keys = ['nil_amt', 'expt_amt', 'ngsup_amt', 'sply_ty']
                    invoice_datas.append(self.set_values(data_keys, [exempted], gstr_return_section))
                summary_type_json.append({'inv': invoice_datas})

            elif gstr_return_section == 'hsn':
                serial_number = 1
                for hsn_summary in read_datas:
                    data_keys = ['num' ,'hsn_sc', 'desc', 'uqc', 'qty', 'val', 'txval', 'iamt', 'camt', 'samt', 'csamt']
                    summary_type_json.append(self.set_values(data_keys, [hsn_summary], gstr_return_section, serial_number))
                    serial_number += 1

            elif gstr_return_section == 'docs':
                gstr_return_section = 'doc_issue'
                for document_type, values in groupby(sorted(read_datas, key= lambda k: k['document_type']), lambda x: x['document_type']):
                    document_datas=[]
                    serial_number = 1
                    for doc_issue in values:
                        data_keys = ['num', 'from', 'to', 'totnum', 'cancel', 'net_issue']
                        document_datas.append({'doc_num': document_type, 'docs': self.set_values(data_keys, [doc_issue], gstr_return_section, serial_number)})
                        serial_number += 1
                    summary_type_json.append({'doc_det': document_datas})

            if summary_type_json:
                json_data.update({gstr_return_section: summary_type_json})

        return json.dumps(json_data, indent=1)

    def set_values(self, keys, values, gstr_return_section, serial_number = 1):
        key_datas = {}
        data = next(iter(values or []), {})
        if gstr_return_section == 'nill':
                key_datas.update({
                    'sply_ty': data.get('out_supply_type','').upper(),
                    'nil_amt': data.get('nil_rated_amount'),
                    'expt_amt': data.get('exempted_amount'),
                    'ngsup_amt': data.get('non_gst_supplies'),
                    })
        elif gstr_return_section == 'doc_issue':
                key_datas.update({
                    'num': serial_number,
                    'from': data.get('num_from'),
                    'to':  data.get('num_to'),
                    'totnum': data.get('total_number'),
                    'cancel': data.get('cancelled'),
                    'net_issue': data.get('net_issued')
                    })
        else:
            itms = self.set_items(values, gstr_return_section)
            if itms:
                key_datas.update({
                    # for invoice
                    'inum': data.get('invoice_number'),
                    'idt': self.set_date_in_format(data.get('invoice_date')),
                    'val': data.get('invoice_total'),
                    'pos': data.get('place_of_supply') and data.get('place_of_supply')[:2] or '',
                    'rchrg': data.get('is_reverse_charge'),
                    'etin': data.get('ecommerce_gstn'),
                    'inv_typ': data.get('b2b_invoice_type'),
                    'txval': data.get('price_total'),
                    'csamt': data.get('cess_amount'),
                    'iamt': data.get('igst_amount'),
                    'camt': data.get('cgst_amount'),
                    'samt': data.get('sgst_amount'),
                    'sply_ty': data.get('supply_type'),
                    "typ": data.get('is_ecommerce'),
                    'rt': data.get('tax_rate'),
                    'itms': itms
                    })
                if gstr_return_section in ['cdnr', 'cdnur']:
                    key_datas.update({
                        'rsn': data.get('refund_reason') or '',
                        'inum': data.get('refund_invoice_number') or '',
                        'idt': self.set_date_in_format(data.get('refund_invoice_data')),
                        'ntty': data.get('refund_document_type'),
                        'nt_num': data.get('invoice_number'),
                        'nt_dt': self.set_date_in_format(data.get('invoice_date')),
                        'p_gst': data.get('is_pre_gst'),
                        "typ": data.get('refund_invoice_type')
                        })
                elif gstr_return_section in ['at', 'atadj']:
                    key_datas.update({
                        'ad_amt': data.get('amount') if type == 'at' else data.get('invoice_payment')
                        })
                elif gstr_return_section == 'hsn':
                    key_datas.update({
                        'num': serial_number,
                        'hsn_sc': data.get('hsn_code'),
                        'desc': data.get('hsn_description'),
                        'uqc': data.get('uom_name'),
                        'qty': data.get('product_qty'),
                        })
        return {key: key_datas.get(key) or self.set_emty_value(key_datas.get(key)) for key in keys}

    def set_items(self, datas, gstr_return_section):
        itms = []
        itms_count = 1
        for data in datas:
            sub_itm = {
                'rt': data.get('tax_rate'),
                'txval': data.get('price_total'),
                'csamt': data.get('cess_amount'),
                'iamt': data.get('igst_amount'),
                'camt': data.get('cgst_amount'),
                'samt': data.get('sgst_amount')
                }
            itms.append(gstr_return_section == 'exp' and sub_itm or {'num': itms_count, 'itm_det': [sub_itm]})
            itms_count += 1
        return itms

    def set_date_in_format(self, str_date):
        return str_date and datetime.strptime(str_date, '%d-%b-%Y').date().strftime('%d-%m-%Y') or ''

    def set_emty_value(self, value):
        if type(value) == bool:
            return ''
        return value
