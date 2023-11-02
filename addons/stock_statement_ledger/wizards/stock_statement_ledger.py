# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from datetime import datetime, time
import time as _time
import base64
from odoo import api, fields, models, _
from odoo.exceptions import Warning, UserError
from odoo.osv import expression
from odoo.tools.float_utils import float_round
from odoo.tools import pycompat
from werkzeug.urls import url_encode

from odoo.addons.web.controllers.export import ExportXlsxWriter

_logger = logging.getLogger(__name__)


class StockExportXlsxWriter(ExportXlsxWriter):

    def __enter__(self):
        return self

    def write_custom_header(self, from_date, to_date, stores):
        self.write(0, 0, "Inventory Running Date", self.header_bold_style)
        self.write(2, 0, "Time", self.header_bold_style)
        self.worksheet.merge_range('A4:A5',  "Store Name", self.header_style) 
        self.write(0, 1, "From", self.header_bold_style)
        self.write(0, 2, "To", self.header_bold_style)
        self.write(1, 1, from_date, self.date_style)
        self.write(1, 2, to_date, self.date_style)
        self.write_cell(2, 1, time.min.strftime("%H:%M:%S"))
        self.write_cell(2, 2, time.max.strftime("%H:%M:%S"))
        self.worksheet.merge_range('B4:C5', ','.join(stores), self.workbook.add_format({'text_wrap': True}))
        for i, fieldname in enumerate(self.field_names):
            self.write(6, i, fieldname, self.header_bold_style)
        self.worksheet.set_column(0, i, 30)


class StockStatementLedger(models.TransientModel):
    _name = 'stock.statement.ledger'
    _description = 'Stock Statement Ledger'
    
    @api.model
    def _get_product_domain(self):
        # As we want to ignore the Loose sale products
        product_tmpl_ids = self.env['mrp.bom'].search([
            ('type','=','phantom')
        ]).mapped('product_tmpl_id.id')
        return [('type','=','product'),('product_tmpl_id','not in',product_tmpl_ids)]

    start_date = fields.Date(string='Start Date', required=True)
    end_date = fields.Date(string='End Date', required=True)
    categ_ids = fields.Many2many(comodel_name='product.category', string='Category')
    product_ids = fields.Many2many(
        comodel_name='product.product',
        domain=lambda self: self._get_product_domain(),
        string='Products'
    )
    location_ids = fields.Many2many(
        comodel_name='stock.location',
        string="Location",
        domain=[('usage', '=', 'internal')],
        required=True,
        help="Select the Location for filtering otherwise the record will be from current selected company warehouse."
    )

    report_data = fields.Binary('Report file', readonly=True, attachment=False)
    report_filename = fields.Char(string='Filename', readonly=True)
    mimetype = fields.Char(string='Mimetype', readonly=True)

    @api.onchange('categ_ids')
    def _onchange_categ_ids(self):
        if self.categ_ids:
            self.product_ids = [(5,)]
            return {'domain': {'product_ids': self._get_product_domain() + [('categ_id', 'in', self.categ_ids.ids)]}}
        else:
            self.product_ids = [(5,)]
            return {'domain': {'product_ids': self._get_product_domain()}}

    def to_prepare_data(self, opening_stock, data):
        """
        Conditions to be checked for export of the data. if fulfills then only consider the 
        product data

        Args:
            opening_stock (float): Opening stock for the current product data
            data (dict): Data received from the SQL Query on product and stock moves.

        Returns:
            bool: True if the condition meets else False
        """
        if not opening_stock and not (data['received_stock'] or data['issue_stock']):
            return False
        return True

    def prepare_data(self, location_id, product_id, data, opening_stock):
        """
        Prepare the list of data to be exported in the Excel Sheet.

        Args:
            product_id (Recordset): Odoo Recordset
            data (dict): Data received from the SQL Query on product and stock moves.
            opening_stock (float): Opening stock for product
            balance_stock (float): Current Balance stock for product

        Returns:
            list: Data to be sent over to the Excel Sheet.
        """
        balance_stock = opening_stock + data['received_stock'] - data['issue_stock']
        return [
            location_id.display_name,
            product_id.display_name,
            product_id.uom_id.name,
            opening_stock,
            data['received_stock'],
            data['issue_stock'],
            balance_stock,
        ]

    def _get_ledger_report_data(self, location_id):
        query = """
(
SELECT
    MIN(sml.id) AS id,
    sml.product_id AS product_id,
    sml.company_id AS company_id,
    sml.date AS date,
    sml.reference As reference,
    sml.location_dest_id as location_dest_id,
    sml.location_id as location_id,
    sm.picking_type_id,
    source_location.usage as source_location_usage,
    dest_location.usage as dest_location_usage,
    CASE
        WHEN (sml.location_dest_id=%(location_id)s) THEN COALESCE(sum(sml.qty_done),0.0)
        ELSE
            0.0 END AS inward_stock,
    CASE
        WHEN (sml.location_id=%(location_id)s) AND sptype.code in ('outgoing') THEN
        COALESCE(sum(sml.qty_done),0.0)
        ELSE
            0.0 END AS outward_stock
FROM stock_move_line sml
LEFT JOIN stock_move sm ON sml.move_id=sm.id
LEFT JOIN product_product p ON (sml.product_id=p.id)
LEFT JOIN product_template t ON (p.product_tmpl_id=t.id)
LEFT JOIN stock_location dest_location ON sml.location_dest_id = dest_location.id
LEFT JOIN stock_location source_location ON sml.location_id = source_location.id
LEFT JOIN stock_picking_type sptype ON sm.picking_type_id = sptype.id
WHERE sml.state IN ('done') AND sml.date BETWEEN %(from_date)s AND %(to_date)s
GROUP BY sml.company_id,
        sml.location_dest_id,
        sml.location_id,
        sml.product_id,
        sml.reference,
        sml.date,
        dest_location.usage,
        dest_location_usage,
        dest_location.id,
        source_location.id,
        source_location_usage,
        sptype.code,
        sm.picking_type_id
ORDER BY sml.company_id, sml.product_id, sml.date
)
        """
        params = {
            'location_id': location_id.id,
            'from_date': fields.Datetime.from_string(datetime.combine(self.start_date, time.min)),
            'to_date': fields.Datetime.from_string(datetime.combine(self.end_date, time.max)),
        }
        stock_move_data_query = self.env.cr.mogrify(query, params).decode(self.env.cr.connection.encoding)
        query = self.env['product.product']._where_calc(self._apply_product_domain())
        tables, where_clause, where_params = query.get_sql()

        self.env.cr.execute(f'''
SELECT 
	product_product.id AS product_id,
	COALESCE(SUM(smd.inward_stock),0.0) AS received_stock,
	COALESCE(SUM(smd.outward_stock),0.0) AS issue_stock
FROM {tables}
LEFT JOIN ({stock_move_data_query}) AS smd ON product_product.id=smd.product_id
WHERE {where_clause}
GROUP BY product_product.id
            ''',where_params)
        data = self.env.cr.dictfetchall()

        product_wise_data = dict()
        for d in data:
            product_wise_data[d.get('product_id')] = d

        # Fetched the below data using the ORM as contains the compute fields.
        product_ids = self.env['product.product'].with_context(get_custom_name=True).search(self._apply_product_domain())
        opening_data = product_ids.with_context(location=location_id.id, compute_child=False)._compute_sml_quantities_dict(to_date=datetime.combine(self.start_date, time.min))
        # closing_data = product_ids.with_context(location=location_id.id)._compute_sml_quantities_dict(to_date=datetime.combine(self.end_date, time.max))

        report_data = list()    # Resultant List to be exported as the Excel sheet row.

        for product in product_ids:
            product_data = product_wise_data.get(product.id)
            opening_stock = opening_data.get(product.id, 0.0)
            # closing_stock = closing_data.get(product.id, 0.0)
            # Check if the product fulfills the prepare condition then only append that to result List.
            if product_data and self.to_prepare_data(opening_stock, product_data):
                report_data.append(self.prepare_data(location_id, product, product_data, opening_stock))
        return report_data

    def _apply_product_domain(self):
        """
        This method will apply the domain on the product based on any product selected by user
        and also used to omit the products which have the BOM.
        """
        product_domain = self._get_product_domain()
        if self.categ_ids and not self.product_ids:
            product_domain = expression.AND([product_domain, [('categ_id', 'in', self.categ_ids.ids)]])
        if self.product_ids:
            product_domain = expression.AND([product_domain,[('id','in',self.product_ids.ids)]])
        return product_domain

    def action_print(self):
        """
        This will compute the result and export the result as the Excel Sheet.
        """
        if self.start_date > self.end_date:
            raise Warning(_("Start Date must be less than End Date."))

        fields_list = ('Location', 'Product Name', 'UOM', 'Opening Stock', 'Received Stock', 
                    'Issue Stock', 'Balance Stock')
        report_data = list()
        file_prepare_time = 0.0
        for location in self.location_ids:
            report_data += self._get_ledger_report_data(location)
            file_prepare_time += _time.time()
        try:
            header_data = {
                'from_date': self.start_date,
                'to_date': self.end_date,
                'stores': self.mapped('location_ids.display_name')
            }
            Writer = StockExportXlsxWriter(fields_list, len(list(report_data)))
            Writer.write_custom_header(**header_data)
            with Writer as xlsx_writer:
                row_index = 7
                for row in list(report_data):
                    for cell_index, cell_value in enumerate(row):
                        xlsx_writer.write_cell(row_index, cell_index, cell_value)
                    row_index += 1
            output = xlsx_writer.value
        except Exception as e:
            _logger.exception(e)
            raise UserError(_(e))

        self.write({
            'report_data': base64.b64encode(output),
            'report_filename': 'Stock Ledger Statement.xls',
            'mimetype': 'application/vnd.ms-excel',
        })
        return {
            'type': 'ir.actions.act_url',
            'url':  '/web/content/?' + url_encode({
                        'model': self._name,
                        'id': self.id,
                        'filename_field': 'report_filename',
                        'field': 'report_data',
                        'download': 'true'
                    }),
            'target': 'self'
        }
