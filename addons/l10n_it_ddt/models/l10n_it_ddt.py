# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _

class L10nItDdt(models.Model):
    _name = 'l10n.it.ddt'
    _description = 'Transport Document'

    name = fields.Char(required=True, copy=False, default='New', readonly=True)
    transport_type = fields.Selection([
        ('our_transport', 'Our Transport'),
        ('your_transport', 'Your Transport'),
        ], default='our_transport', string='Transport Type')
    partner_id = fields.Many2one('res.partner', string='Partner', required=True)
    partner_invoice_id = fields.Many2one(
        'res.partner',
        string='Invoice Address')
    partner_shipping_id = fields.Many2one(
        'res.partner',
        string='Shipping Information')
    type_id = fields.Many2one('l10n.it.ddt.type', string='DDT Type')
    tag_id = fields.Many2one('l10n.it.ddt.tag', string='DDT Tag')
    company_id = fields.Many2one('res.company', string='Company', required=True)
    warehouse_id = fields.Many2one('stock.warehouse', required=True)
    picking_ids = fields.One2many(
        'stock.picking', 'l10n_it_ddt_id',
        string='Related Transfers', readonly=True)
    packages = fields.Integer(string="Packages")
    weight = fields.Float(string="Weight")

    @api.model
    def create(self, vals):
        if vals.get('name', _('New')) == _('New'):
            vals['name'] = self.env['ir.sequence'].next_by_code(
                'l10n.it.ddt') or _('New')
        return super(L10nItDdt, self).create(vals)


class L10nItDdtTag(models.Model):
    _name = 'l10n.it.ddt.tag'

    name = fields.Char('Name')


class L10nItDdtType(models.Model):
    _name = 'l10n.it.ddt.type'

    name = fields.Char('Name')