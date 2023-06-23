# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class EwaybillStock(models.Model):
    _name = "l10n.in.ewaybill"
    _inherit = ['portal.mixin', 'mail.thread', 'mail.activity.mixin']


    stock_picking_id = fields.Many2one("stock.picking", "Stock Transfer")
    date = fields.Datetime(related="stock_picking_id.scheduled_date")
    
    move_ids = fields.One2many(related="stock_picking_id.move_ids",readonly=False)
    currency_id = fields.Many2one(
        related='stock_picking_id.currency_id',
        depends=['stock_picking_id.currency_id'],
        store=True)
    tax_totals = fields.Binary(compute='_compute_tax_totals')
    state = fields.Selection(
        selection=[
            ('draft', 'Draft'),
            ('posted', 'Posted'),
            ('cancel', 'Cancelled'),
        ],
        string='Status',
        required=True,
        readonly=True,
        copy=False,
        tracking=True,
        default='draft',
    )


    l10n_in_transporter_id = fields.Many2one("res.partner", "Transporter", copy=False)
    l10n_in_distance = fields.Integer("Distance")
    l10n_in_mode = fields.Selection([
        ("1", "Road"),
        ("2", "Rail"),
        ("3", "Air"),
        ("4", "Ship")],
        string="Transportation Mode", copy=False)

    # Vehicle Number and Type required when transportation mode is By Road.
    l10n_in_vehicle_no = fields.Char("Vehicle Number", copy=False)
    l10n_in_vehicle_type = fields.Selection([
        ("R", "Regular"),
        ("O", "ODC")],
        string="Vehicle Type", copy=False)

    l10n_in_transportation_doc_no = fields.Char(
        string="E-waybill Document Number",
        help="""Transport document number. If it is more than 15 chars, last 15 chars may be entered""",
        copy=False)
    l10n_in_transportation_doc_date = fields.Date(
        string="Document Date",
        help="Date on the transporter document",
        copy=False)




    @api.depends('move_ids.tax_id', 'move_ids.price', 'stock_picking_id.amount_total', 'stock_picking_id.amount_untaxed', 'stock_picking_id.currency_id')
    def _compute_tax_totals(self):
        for order in self:
            order_lines = order.move_ids
            order.tax_totals = self.env['account.tax']._prepare_tax_totals(
                [x._convert_to_tax_base_line_dict() for x in order_lines],
                order.stock_picking_id.currency_id or order.stock_picking_id.company_id.currency_id,
            )
