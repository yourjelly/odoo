# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class L10nItDdt(models.Model):
    _name = 'l10n.it.ddt'

    name = fields.Char(
        string='DDT Number', required=True,
        copy=False, default='New',
        readonly=True)
    state = fields.Selection([
        ('draft', 'draft'),
        ('done', 'Done'),
        ], string='Status', default='draft')
    partner_id = fields.Many2one('res.partner', string='Partner')
    partner_invoice_id = fields.Many2one(
        'res.partner',
        string='Invoice Address')
    partner_shipping_id = fields.Many2one(
        'res.partner',
        string='Shipping Information')
    ddt_type_id = fields.Many2one('l10n.it.ddt.type', string='DDT Type')
    company_id = fields.Many2one('res.company', string='Company')
    stock_picking_ids = fields.One2many(
        'stock.picking', 'l10n_it_ddt_id',
        string='Related Transfers')
    ddt_line_id = fields.One2many(
        'l10n.it.ddt.line', 'ddt_id',
        string='DDT id')

    @api.multi
    def action_confirm(self):
        self.ensure_one()
        if self.state == 'draft':
            self.write({
                'name': self.env['ir.sequence'].next_by_code('l10n.it.ddt'),
                'state': 'done'
                })

    @api.multi
    def do_print_ddt(self):
        return self.env.ref('l10n_it_ddt.action_report_ddt').report_action(self)


class L10nItDdtType(models.Model):
    _name = 'l10n.it.ddt.type'

    name = fields.Char('Name')


class L10nItLine(models.Model):
    _name = 'l10n.it.ddt.line'

    name = fields.Text(string='Description', required=True)
    product_id = fields.Many2one('product.product', string='Product')
    quantity = fields.Integer(string='quantity')
    product_uom_id = fields.Many2one('uom.uom', string='Unit of Measure')
    unit_price = fields.Float(string='Unit Price')
    discount = fields.Float(string='Discount')
    tax_ids = fields.Many2many('account.tax', string='Taxes')
    ddt_id = fields.Many2one('l10n.it.ddt', string="DDT")
