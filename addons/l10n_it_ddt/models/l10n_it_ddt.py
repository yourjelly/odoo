# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.exceptions import Warning as UserError


class L10nItDdt(models.Model):
    _name = 'l10n.it.ddt'

    name = fields.Char(
        string='DDT Number', required=True,
        copy=False, default='New',
        readonly=True)
    transport_type = fields.Selection([
        ('our_transport', 'Our Transport'),
        ('your_transport', 'Your Transport'),
        ], string='Transport Type')
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
    packages = fields.Integer(string="Packages")
    weight = fields.Float(string="Weight")

    @api.model
    def create(self, vals):
        if vals.get('name', _('New')) == _('New'):
            vals['name'] = self.env['ir.sequence'].next_by_code(
                'l10n.it.ddt') or _('New')
        return super(L10nItDdt, self).create(vals)

    def _check_linked_picking(self, pickings):
        for picking in pickings:
            if picking.partner_id != self.partner_id:
                raise UserError(
                    _("Selected Picking have different Partner from DDT"))


class L10nItDdtTag(models.Model):
    _name = 'l10n.it.ddt.tag'

    name = fields.Char('Name')


class L10nItDdtType(models.Model):
    _name = 'l10n.it.ddt.type'

    name = fields.Char('Name')


class Stock_Move(models.Model):
    _name = 'stock.move'
    _inherit = 'stock.move'

    unit_price = fields.Float(
        string='Unit Price', related='sale_line_id.price_unit')
    discount = fields.Float(string='Discount', related='sale_line_id.discount')
    tax_ids = fields.Many2many(
        'account.tax', string='Taxes', related='sale_line_id.tax_id')
