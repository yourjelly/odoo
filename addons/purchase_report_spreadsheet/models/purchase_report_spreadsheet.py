import io
from odoo import models, fields, api
from odoo.tools.misc import xlsxwriter
import base64

class PurchaseReportSpreadsheet(models.Model):
    _name = 'purchase.report.spreadsheet'
    _description = 'Purchase Report Spreadsheet'

    @api.model
    def fetch_purchase_report_data(self):
        records = self.env['purchase.order.line'].read_group(
            domain=[],
            fields=['product_id', 'product_qty:sum', 'price_total:sum'],
            groupby=['product_id'],
            orderby='price_total desc',
            lazy=False
        )
        # print(records[:100])
        return records
    
    def generate_excel_report(self):
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})

        sheet = workbook.add_worksheet("invoices")

        header_style = workbook.add_format({'bold': True, 'bg_color': '#0070C0', 'color': '#FFFFFF', 'font_size': 8, 'border': 1})

        sheet.write(0, 0, 'Product', header_style)
        sheet.write(0, 1, 'Ordered Quantity', header_style)
        sheet.write(0, 2, 'Total', header_style)

        report_lines = self.fetch_purchase_report_data()

        row = 1

        for line in report_lines:
            # breakpoint()
            sheet.set_row(row, 20)
            sheet.write(row, 0, self.env['product.product'].browse([int(line['product_id'][0])]).name)
            sheet.write(row, 1, int(line['product_qty']))
            sheet.write(row, 2, float(line['price_total']))
            row += 1

        workbook.close()
        output.seek(0)
        return output.read()
    
    def send_report_email(self):
        company = self.env.user.company_id
        excel_data = self.generate_excel_report()
        data = base64.b64encode(excel_data)

        mail = self.env['mail.mail'].create({
            'subject': 'Monthly Excel Report',
            'body_html': 'Please find the attached Excel report.',
            'email_from': company.catchall_formatted or company.email_formatted,
            'email_to': 'jash@odoo,com',
        })

        attachment = self.env['ir.attachment'].create({
            'name': 'Invoice_report.xlsx',
            'type': 'binary',
            'datas': data,
            'store_fname': 'Invoice_report.xlsx',
            'res_model': 'mail.mail',
            'res_id': mail.id,
        })

        mail.attachment_ids = [(6, 0, [attachment.id])]
        mail.send()
