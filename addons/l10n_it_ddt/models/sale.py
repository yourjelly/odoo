# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class SaleOrder(models.Model):
    _inherit = "sale.order"

    ddt_ids = fields.Many2many('l10n.it.ddt', string="DDT")
    auto_ddt = fields.Boolean()
    ddt_count = fields.Integer(
        string='DDT Count',
        compute='_get_ddt_count', readonly=True)

    def _get_ddt_count(self):
        for order in self:
            order.ddt_count = len(self.mapped('ddt_ids'))


    @api.multi
    def action_view_ddt(self):
        ddt = self.mapped('ddt_ids')
        form_view_id = self.env.ref('l10n_it_ddt.l10n_it_ddt_form').id
        tree_view_id = self.env.ref('l10n_it_ddt.l10n_it_ddt_tree').id
        result = {
                    "name": "DDT",
                    "type": "ir.actions.act_window",
                    "res_model": "l10n.it.ddt"
                }
        if len(ddt) == 1:
            result.update({
                "views": [[form_view_id, "form"]],
                "res_id": ddt.ids[0],
                })
        else:
            result.update({
                    "views": [[tree_view_id, "tree"]],
                    "domain": [('id', 'in', ddt.ids)]
                })
        return result
