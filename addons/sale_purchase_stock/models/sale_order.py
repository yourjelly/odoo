# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class StockMove(models.Model):
    _inherit = 'stock.move'

    def _prepare_procurement_values(self):
        res = super(StockMove, self)._prepare_procurement_values()
        if self.group_id.sale_id:
            res['sale_ids'] = [(4, self.group_id.sale_id.id, None)]
        return res


class StockRule(models.Model):
    _inherit = 'stock.rule'

    def _prepare_purchase_order(self, company_id, origins, values):
        res = super(StockRule, self)._prepare_purchase_order(company_id, origins, values)
        sale_ids = values[0].get('sale_ids')
        if sale_ids:
            res['sale_ids'] = sale_ids
        return res

    @api.model
    def _update_purchase_origin(self, po, procurements):
        super(StockRule, self)._update_purchase_origin(po, procurements)
        sale_ids = procurements[0].values.get('sale_ids')
        if sale_ids:
            po.write({'sale_ids': sale_ids})
