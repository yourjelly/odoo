import io
from odoo import http
from odoo.http import request, content_disposition
from odoo.tools.misc import xlsxwriter

# class PurchaseReportController(http.Controller):
#    @http.route([
#        '/invoicing/excel_report/<model("invoice.reports"):report_id>',
#    ], type='http', auth="user", csrf=False)
#    def get_sale_excel_report(self, report_id=None, **args):
#        response = request.make_response(
#            None,
#            headers=[
#                ('Content-Type', 'application/vnd.ms-excel'),
#                ('Content-Disposition', content_disposition('Invoice_report' + '.xlsx'))
#            ]
#        )
#        header_style = workbook.add_format({'bold': True, 'bg_color': '#0070C0', 'color': '#FFFFFF', 'font_size': 8, 'border': 1})
#        output = io.BytesIO()
#        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
#        #get data for the report.
#        report_lines = report_id.get_report_lines()
#        # prepare excel sheet styles and formats
#        sheet = workbook.add_worksheet("invoices")
#        sheet.write(1, 0, 'Product', header_style)
#        sheet.write(1, 1, 'Ordered Quantity', header_style)
#        sheet.write(1, 2, 'Total', header_style)
       
#        row = 2
#        number = 1  
#        # write the report lines to the excel document
#        for line in report_lines:       
#            sheet.set_row(row, 20)
#            sheet.write(row, 0, line['product_id'], header_style)
#            sheet.write(row, 1, line['product_qty'], header_style)
#            sheet.write(row, 2, line['price_total'], header_style)  
#            row += 1
#            number += 1
#        workbook.close()
#        output.seek(0)
#        response.stream.write(output.read())
#        output.close()
#        return response