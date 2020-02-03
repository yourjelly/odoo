# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, tools


class ReportStockQuantity(models.Model):
    _name = 'report.stock.quantity'
    _auto = False
    _description = 'Stock Quantity Report'

    date = fields.Date(string='Date', readonly=True)
    product_tmpl_id = fields.Many2one('product.template', related='product_id.product_tmpl_id')
    product_id = fields.Many2one('product.product', string='Product', readonly=True)
    state = fields.Selection([
        ('forecast', 'Forecasted Stock'),
        ('in', 'Forecasted Receipts'),
        ('out', 'Forecasted Deliveries'),
    ], string='State', readonly=True)
    product_qty = fields.Float(string='Quantity', readonly=True)
    move_ids = fields.One2many('stock.move', readonly=True)
    company_id = fields.Many2one('res.company', readonly=True)
    warehouse_id = fields.Many2one('stock.warehouse', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self._cr, 'report_stock_quantity')
        domain_locations = self.env['product.product']._get_domain_locations()
        domain_in, domain_out = domain_locations[1], domain_locations[2]
        from_in, where_clause_in, params_in = self.env['stock.move']._where_calc(domain_in).get_sql()
        from_out, where_clause_out, params_out = self.env['stock.move']._where_calc(domain_out).get_sql()
        query = """
CREATE or REPLACE VIEW report_stock_quantity AS (
SELECT
    stock_move.id,
    stock_move.product_id,
    'in' AS state,
    stock_move.date_expected::date AS date,
    stock_move.product_qty,
    stock_move.company_id,
    stock_warehouse.id AS warehouse_id
FROM
    stock_warehouse,
    %s
WHERE
    stock_move__location_dest_id.parent_path LIKE CONCAT('%%%%/', stock_warehouse.view_location_id, '/%%%%') AND
    stock_move.state NOT IN ('cancel', 'draft', 'done') AND
    %s
UNION
SELECT
    stock_move.id,
    stock_move.product_id,
    'out' AS state,
    stock_move.date_expected::date AS date,
    - stock_move.product_qty AS product_qty,
    stock_move.company_id,
    stock_warehouse.id AS warehouse_id
FROM
    stock_warehouse,
    %s
WHERE
    stock_move__location_id.parent_path LIKE CONCAT('%%%%/', stock_warehouse.view_location_id, '/%%%%') AND
    stock_move.state NOT IN ('cancel', 'draft', 'done') AND
    %s
UNION
SELECT
    -q.id as id,
    product_id,
    'forecast' as state,
    date.*::date,
    quantity as product_qty,
    q.company_id,
    wh.id as warehouse_id
FROM
    GENERATE_SERIES((now() at time zone 'utc')::date - interval '3month',
    (now() at time zone 'utc')::date + interval '3 month', '1 day'::interval) date,
    stock_quant q
LEFT JOIN stock_location l on (l.id=q.location_id)
LEFT JOIN stock_warehouse wh ON l.parent_path like concat('%%%%/', wh.view_location_id, '/%%%%')
WHERE
    l.usage = 'internal'
UNION
SELECT
    stock_move.id,
    stock_move.product_id,
    'forecast' as state,
    GENERATE_SERIES(
        (now() at time zone 'utc')::date - interval '3month', date::date - interval '1 day', '1 day'::interval
    )::date date,
    - stock_move.product_qty AS product_qty,
    stock_move.company_id,
    stock_warehouse.id
FROM
    stock_warehouse,
    %s
WHERE
    stock_move__location_dest_id.parent_path LIKE CONCAT('%%%%/', stock_warehouse.view_location_id, '/%%%%') AND
    stock_move.state = 'done' AND
    %s
UNION
SELECT
    stock_move.id,
    stock_move.product_id,
    'forecast' as state,
    GENERATE_SERIES(
        (now() at time zone 'utc')::date - interval '3month', date::date - interval '1 day', '1 day'::interval
    )::date date,
    stock_move.product_qty AS product_qty,
    stock_move.company_id,
    stock_warehouse.id
FROM
    stock_warehouse,
    %s
WHERE
    stock_move__location_id.parent_path LIKE CONCAT('%%%%/', stock_warehouse.view_location_id, '/%%%%') AND
    stock_move.state = 'done' AND
    %s
UNION
SELECT
    stock_move.id,
    stock_move.product_id,
    'forecast' as state,
    GENERATE_SERIES(
        date_expected::date, (now() at time zone 'utc')::date + interval '3 month', '1 day'::interval
    )::date date,
    stock_move.product_qty AS product_qty,
    stock_move.company_id,
    stock_warehouse.id
FROM
    stock_warehouse,
    %s
WHERE
    stock_move__location_dest_id.parent_path LIKE CONCAT('%%%%/', stock_warehouse.view_location_id, '/%%%%') AND
    stock_move.state IN ('confirmed', 'waiting', 'assigned', 'partially_available') AND
    %s
UNION
SELECT
    stock_move.id,
    stock_move.product_id,
    'forecast' as state,
    GENERATE_SERIES(
        date_expected::date, (now() at time zone 'utc')::date + interval '3 month', '1 day'::interval
    )::date date,
    - stock_move.product_qty AS product_qty,
    stock_move.company_id,
    stock_warehouse.id
FROM
    stock_warehouse,
    %s
WHERE
    stock_move__location_id.parent_path LIKE CONCAT('%%%%/', stock_warehouse.view_location_id, '/%%%%') AND
    stock_move.state IN ('confirmed', 'waiting', 'assigned', 'partially_available') AND
    %s
);
""" % tuple([from_in, where_clause_in, from_out, where_clause_out] * 3)
        self.env.cr.execute(query, (params_in + params_out) * 3)
