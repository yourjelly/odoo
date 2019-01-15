# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.exceptions import Warning as UserError


class L10nItDdt(models.Model):
    _name = 'l10n.it.ddt'

    @api.depends('partner_shipping_id', 'partner_id')
    def _compute_transport_data(self):
        for record in self:
            if record.partner_shipping_id.commercial_partner_id == record.partner_id:
                record.transport_type = 'our_transport'
            else:
                record.transport_type = 'your_transport'

    name = fields.Char(
        string='DDT Number', required=True,
        copy=False, default='New',
        readonly=True)
    state = fields.Selection([
        ('draft', 'draft'),
        ('done', 'Done'),
        ], string='Status', default='draft')
    transport_type = fields.Selection([
        ('our_transport', 'Our Transport'),
        ('your_transport', 'Your Transport'),
        ], string='Transport Type', compute="_compute_transport_data")
    partner_id = fields.Many2one('res.partner', string='Partner')
    partner_invoice_id = fields.Many2one(
        'res.partner',
        string='Invoice Address')
    partner_shipping_id = fields.Many2one(
        'res.partner',
        string='Shipping Information')
    ddt_type_id = fields.Many2one('l10n.it.ddt.type', string='DDT Type')
    ddt_tag_id = fields.Many2one('l10n.it.ddt.tag', string='DDT Tag')
    company_id = fields.Many2one('res.company', string='Company')
    stock_picking_ids = fields.One2many(
        'stock.picking', 'l10n_it_ddt_id',
        string='Related Transfers')
    ddt_line_ids = fields.One2many(
        'l10n.it.ddt.line', 'ddt_id',
        string='DDT id')
    packages = fields.Integer(string="Packages")
    weight = fields.Float(string="Weight")

    @api.model
    def create(self, vals):
        if vals.get('name', _('New')) == _('New'):
            vals['name'] = self.env['ir.sequence'].next_by_code('l10n.it.ddt') or _('New')
        return super(L10nItDdt, self).create(vals)

    @api.multi
    def _update_lines(self):
        self.ensure_one()
        new_moves = self.stock_picking_ids.mapped('move_lines') - self.ddt_line_ids.mapped('move_line_id')
        self.ddt_line_ids = [(0, 0, new_move._pripare_ddt_line()) for new_move in new_moves]


    @api.multi
    def action_confirm(self):
        self.ensure_one()
        if self.state == 'draft':
            self.state ='done'

    def _check_linked_picking(self, pickings):
        for picking in pickings:
            if picking.partner_id != self.partner_id:
                raise UserError(
                    _("Selected Picking have different Partner from DDT"))


class L10nItDdtType(models.Model):
    _name = 'l10n.it.ddt.tag'

    name = fields.Char('Name')


class L10nItDdtType(models.Model):
    _name = 'l10n.it.ddt.type'

    name = fields.Char('Name')


class L10nItDdtLine(models.Model):
    _name = 'l10n.it.ddt.line'

    name = fields.Text(string='Description', required=True)
    product_id = fields.Many2one('product.product', string='Product')
    quantity = fields.Integer(string='quantity')
    product_uom_id = fields.Many2one('uom.uom', string='Unit of Measure')
    unit_price = fields.Float(string='Unit Price')
    discount = fields.Float(string='Discount')
    tax_ids = fields.Many2many('account.tax', string='Taxes')
    ddt_id = fields.Many2one('l10n.it.ddt', string="DDT")
    move_line_id = fields.Many2one('stock.move', string="Stock Move")
