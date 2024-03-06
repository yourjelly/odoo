# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, Command


class StockWarnInsufficientQty(models.AbstractModel):
    _name = 'stock.warn.insufficient.qty'
    _description = 'Warn Insufficient Quantity'

    def _default_quant_ids(self):
        company = self._get_reference_company_id()
        quant_ids = self.env['stock.quant'].search([
            *self.env['stock.quant']._check_company_domain(company),
            ('product_id', '=', self._context.get('default_product_id')),
            ('location_id.usage', '=', 'internal'),
        ])
        print(company, quant_ids)
        return quant_ids if quant_ids else False

    product_id = fields.Many2one('product.product', 'Product', required=True)
    location_id = fields.Many2one('stock.location', 'Location', domain="[('usage', '=', 'internal')]", required=True)
    quant_ids = fields.Many2many('stock.quant', compute='_compute_quant_ids', default=_default_quant_ids)
    quantity = fields.Float(string="Quantity", required=True)
    product_uom_name = fields.Char("Unit of Measure", required=True)

    def _get_reference_document_company_id(self):
        raise NotImplementedError()

    def _get_reference_company_id(self):
        company = self.env['stock.scrap'].browse(self._context.get('default_scrap_id')).company_id
        return company

    @api.depends('product_id')
    def _compute_quant_ids(self):
        for quantity in self:
            company = quantity._get_reference_document_company_id()
            quantity.quant_ids = self.env['stock.quant'].search([
                *self.env['stock.quant']._check_company_domain(company),
                ('product_id', '=', quantity.product_id.id),
                ('location_id.usage', '=', 'internal'),
            ])

    def action_done(self):
        raise NotImplementedError()


class StockWarnInsufficientQtyScrap(models.TransientModel):
    _name = 'stock.warn.insufficient.qty.scrap'
    _inherit = 'stock.warn.insufficient.qty'
    _description = 'Warn Insufficient Scrap Quantity'

    scrap_id = fields.Many2one('stock.scrap', 'Scrap')

    def _get_reference_document_company_id(self):
        return self.scrap_id.company_id

    def action_done(self):
        return self.scrap_id.do_scrap()

    def action_cancel(self):
        # FIXME in master: we should not have created the scrap in a first place
        if self.env.context.get('not_unlink_on_discard'):
            return True
        else:
            return self.scrap_id.sudo().unlink()
