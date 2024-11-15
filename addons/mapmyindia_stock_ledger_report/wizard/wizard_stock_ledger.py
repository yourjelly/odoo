import base64
import xlsxwriter
from io import BytesIO

from odoo import models, fields, api, _


# Create Uid : [1, 'OdooBot']
# Create Date : 2022-07-08 12:05:26
# Write Uid : [1, 'OdooBot']
# Write Date : 2022-07-08 12:05:26
class WizardStockLedger(models.TransientModel):
    _name = "wizard.stock.ledger"
    _description = "Wizard Stock Ledger"

    datas = fields.Binary(string="Datas")
    datas_fname = fields.Char(string="File Name")
    name = fields.Char(string="Name")
    from_date = fields.Datetime(string="From Date", required=True)
    to_date = fields.Datetime(string="To Date", required=True)
    location_ids = fields.Many2many(
        string="Locations",
        comodel_name="stock.location",
        relation="stock_location_wizard_stock_ledger_rel",
        column1="wizard_stock_ledger_id",
        column2="stock_location_id",
    )
    product_categ_ids = fields.Many2many(
        string="Product Category",
        comodel_name="product.category",
        relation="product_category_wizard_stock_ledger_rel",
        column1="wizard_stock_ledger_id",
        column2="product_category_id",
    )
    product_ids = fields.Many2many(
        string="Product",
        comodel_name="product.product",
        relation="product_product_wizard_stock_ledger_rel",
        column1="wizard_stock_ledger_id",
        column2="product_product_id",
    )

    based_on = fields.Selection(string="Based On", selection=[("products", "Products"), ("categories", "Categories")])
    report_type = fields.Selection(
        string="Report Type", selection=[("summary", "Summary Report"), ("detailed", "Detail Report")],
        default="detailed"
    )

    # [Stock Statement Material] Print Ledger Report - Jar
    # mapmyindia_stock_ledger_report.action_server_stock_statement_jar
    def action_server_stock_statement_jar(self):
        product_domain = []
        location_domain = [("usage", "=", "internal")]
        from_date = self.from_date
        to_date = self.to_date

        if self.based_on == "products" and self.product_ids:
            product_domain = [("id", "in", self.product_ids.ids)]

        if self.based_on == "categories" and self.product_categ_ids:
            product_domain = [("categ_id", "in", self.product_categ_ids.ids)]

        products = self.env["product.product"].search(product_domain)
        data = BytesIO()
        workbook = xlsxwriter.Workbook(data, {
            'in_memory': True,
            'strings_to_formulas': False,
        })
        worksheet = workbook.add_worksheet("Stock Ledger")
        if self.location_ids:
            location_domain.append(("id", "in", self.location_ids.ids))
        location_ids = self.env["stock.location"].search(location_domain, order="complete_name")
        product_ids = products.ids

        if self.report_type == "summary":
            fname = "Summary"
            header = ["Sequence", "Internal Reference", "Product Name", "Opening Qty", "IN Qty", "OUT Qty", "Qty On Hand"]
            self.env.cr.execute("""
                WITH opening_in AS (
                     SELECT move.product_id,
                            loc_internal.id AS location_id,
                            SUM(move.quantity) AS qty
                       FROM stock_location AS loc_internal
                  LEFT JOIN stock_move AS move
                         ON loc_internal.id = move.location_dest_id
                      WHERE loc_internal.usage = 'internal'
                        AND move.state = 'done'
                        AND move.date < %s
                        AND move.company_id IN %s
                   GROUP BY move.product_id, loc_internal.id
                    ),
                    opening_out AS (
                     SELECT move.product_id,
                            loc_internal.id AS location_id,
                            SUM(move.quantity) AS qty
                       FROM stock_location AS loc_internal
                  LEFT JOIN stock_move AS move
                         ON loc_internal.id = move.location_id
                      WHERE loc_internal.usage = 'internal'
                        AND move.state = 'done'
                        AND move.date < %s
                        AND move.company_id IN %s
                   GROUP BY move.product_id, loc_internal.id
                    ),
                    move_in AS (
                     SELECT move.product_id,
                            loc_internal.id AS location_id,
                            SUM(move.product_uom_qty) AS qty
                       FROM stock_location AS loc_internal
                  LEFT JOIN stock_move AS move
                         ON loc_internal.id = move.location_dest_id
                      WHERE loc_internal.usage = 'internal'
                        AND move.state = 'done'
                        AND move.date >= %s
                        AND move.date < %s
                        AND move.company_id IN %s
                   GROUP BY move.product_id, loc_internal.id
                    ),
                    move_out AS (
                     SELECT move.product_id,
                            loc_internal.id AS location_id,
                            SUM(move.product_uom_qty) AS qty
                       FROM stock_location AS loc_internal
                  LEFT JOIN stock_move AS move
                         ON loc_internal.id = move.location_id
                      WHERE loc_internal.usage = 'internal'
                        AND move.state = 'done'
                        AND move.date >= %s
                        AND move.date < %s
                        AND move.company_id IN %s
                   GROUP BY move.product_id, loc_internal.id
                    )
                SELECT sl.id AS location_id,
                       pp.id AS product_id,
                       COALESCE(SUM(opening_in.qty), 0) - COALESCE(SUM(opening_out.qty), 0) AS opening,
                       COALESCE(SUM(move_in.qty), 0) AS in_qty,
                       COALESCE(SUM(move_out.qty), 0) AS out_qty
                  FROM stock_location sl
                  JOIN product_product pp
                    ON 1 = 1
             LEFT JOIN opening_in
                    ON opening_in.location_id = sl.id
                   AND opening_in.product_id = pp.id
             LEFT JOIN opening_out
                    ON opening_out.location_id = sl.id
                   AND opening_out.product_id = pp.id
             LEFT JOIN move_in
                    ON move_in.location_id = sl.id
                   AND move_in.product_id = pp.id
             LEFT JOIN move_out
                    ON move_out.location_id = sl.id
                   AND move_out.product_id = pp.id
              GROUP BY pp.id, sl.id
            """, (
                from_date, tuple(self.env.company.ids), from_date, tuple(self.env.company.ids), from_date, to_date, tuple(self.env.company.ids),
                from_date, to_date, tuple(self.env.company.ids)
            ))
            quantities = {}
            for row in self.env.cr.dictfetchall():
                location_id = row['location_id']
                product_id = row['product_id']
                quantities[(product_id, location_id)] = {
                    'opening': row['opening'],
                    'in_qty': row['in_qty'],
                    'out_qty': row['out_qty'],
                }
            row_num = 1

            for loc in location_ids:
                worksheet.write(row_num, 0, loc.name)
                worksheet.write(row_num, 2, f"From Date: {from_date.strftime('%d-%m-%Y')}")
                worksheet.write(row_num, 5, f"To Date: {to_date.strftime('%d-%m-%Y')}")
                row_num += 1

                for col_num, item in enumerate(header):
                    worksheet.write(row_num, col_num, item)
                row_num += 1

                seq = 1
                for product in products:
                    qty_data = quantities.get((product.id, loc.id), {})
                    opening_qty = qty_data.get("opening", 0)
                    in_qty = qty_data.get("in_qty", 0)
                    out_qty = qty_data.get("out_qty", 0)
                    closing_qty = opening_qty + in_qty - out_qty

                    worksheet.write_row(row_num, 0, [
                        seq, product.default_code or "", product.name or "",
                        f"{opening_qty:.2f}", f"{in_qty:.2f}", f"{out_qty:.2f}", f"{closing_qty:.2f}"
                    ])
                    seq += 1
                    row_num += 1
                row_num += 1
        else:
            fname = "Detail"
            header = ["Date", "Partner", "Voucher No", "Stock In", "Value", "Stock Out", "Value", "Transfer", "Value", "Closing Stock", "Value"]
            for col_num, item in enumerate(header):
                worksheet.write(0, col_num, item)

            opening_qty_query = """
                   SELECT sm.product_id,
                          SUM(
                            CASE
                                WHEN sl_from.usage NOT IN ('internal', 'transit')
                                 AND sl_to.usage IN ('internal', 'transit')
                                THEN sm.quantity
                                ELSE 0
                            END) -
                          SUM(
                            CASE
                                WHEN sl_from.usage IN ('internal', 'transit')
                                 AND sl_to.usage NOT IN ('internal', 'transit')
                                THEN sm.quantity
                                ELSE 0
                            END
                         ) AS opening_qty
                     FROM stock_move sm
                LEFT JOIN stock_location sl_from
                       ON sm.location_id = sl_from.id
                LEFT JOIN stock_location sl_to
                       ON sm.location_dest_id = sl_to.id
                    WHERE sm.product_id IN %s
                      AND sm.date < %s
                      AND sm.state = 'done'
                 GROUP BY sm.product_id
            """
            self.env.cr.execute(opening_qty_query, (tuple(product_ids), from_date))
            opening_qty_data = {row['product_id']: row['opening_qty'] or 0.0 for row in self.env.cr.dictfetchall()}

            moves_query = """
                   SELECT sm.product_id,
                          sm.date,
                          rp.name AS partner_name,
                          sm.reference,
                          sm.quantity,
                          COALESCE(svl.value, 0.0) AS value,
                          sl_from.usage AS from_usage,
                          sl_to.usage AS to_usage
                     FROM stock_move sm
                LEFT JOIN res_partner rp
                       ON sm.picking_id = rp.id
                LEFT JOIN stock_valuation_layer svl
                       ON svl.stock_move_id = sm.id
                LEFT JOIN stock_location sl_from
                       ON sm.location_id = sl_from.id
                LEFT JOIN stock_location sl_to
                       ON sm.location_dest_id = sl_to.id
                    WHERE sm.product_id IN %s
                      AND sm.date >= %s
                      AND sm.date <= %s
                      AND sm.state = 'done'
                      AND sm.company_id IN %s
                 ORDER BY sm.product_id, sm.date
            """
            self.env.cr.execute(moves_query, (tuple(product_ids), from_date, to_date, tuple(self.env.company.ids)))
            moves_data = self.env.cr.dictfetchall()
            moves_data_by_product = {}
            for row in moves_data:
                product_id = row['product_id']
                if product_id not in moves_data_by_product:
                    moves_data_by_product[product_id] = []
                moves_data_by_product[product_id].append(row)

            row_num = 1
            for product in products:
                worksheet.write(row_num, 0, product.name)
                row_num += 1

                opening_qty = opening_qty_data.get(product.id, 0.0)
                closing_qty = opening_qty

                worksheet.write(row_num, 0, "Opening Qty")
                worksheet.write(row_num, 9, f"{opening_qty:.2f}")
                row_num += 1

                for move in moves_data_by_product.get(product.id, []):
                    move_date = move['date'].strftime("%d-%m-%Y")
                    partner_name = move['partner_name'] or " "
                    voucher_no = move['reference'] or " "
                    quantity = move['quantity']
                    value = move['value']
                    from_usage = move['from_usage']
                    to_usage = move['to_usage']

                    if from_usage not in ["internal", "transit"] and to_usage in ["internal", "transit"]:
                        closing_qty += quantity
                        worksheet.write_row(row_num, 0, [
                            move_date, partner_name, voucher_no, f"{quantity:.2f}", f"{value:.2f}", "0.00", "0.00", "0.00", "0.00", f"{closing_qty:.2f}", "value"
                        ])
                    elif from_usage in ["internal", "transit"] and to_usage not in ["internal", "transit"]:
                        closing_qty -= quantity
                        worksheet.write_row(row_num, 0, [
                            move_date, partner_name, voucher_no, "0.00", "0.00", f"{quantity:.2f}", f"{value:.2f}", "0.00", "0.00", f"{closing_qty:.2f}", "value"
                        ])
                    elif from_usage in ["internal", "transit"] and to_usage in ["internal", "transit"]:
                        worksheet.write_row(row_num, 0, [
                            move_date, partner_name, voucher_no, "0.00", "0.00", "0.00", "0.00", f"{quantity:.2f}", f"{value:.2f}", f"{closing_qty:.2f}", "value"
                        ])
                    row_num += 1
                row_num += 1

        workbook.close()
        data.seek(0)

        self.datas = base64.b64encode(data.read())
        file_name = "Stock Ledger Report_{}_{}".format(fname, fields.Datetime.today().strftime("%d-%m-%Y %H:%M:%S"))
        self.datas_fname = file_name + ".xlsx"
        action = self.env["ir.actions.actions"]._for_xml_id('mapmyindia_stock_ledger_report.action_act_window_stock_ledger_jar')
        action["res_id"] = self.id

        return action
