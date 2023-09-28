# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    # l10n_ke_oscu_branch_ids = fields.One2many(
    #     string="Branch IDs",
    #     related="company_id.l10n_ke_oscu_branch_ids",
    #     readonly=False,
    # )

    # def open_l10n_ke_edi_oscu_branch_list(self):
    #     self.ensure_one()
    #     return {
    #         'type': 'ir.actions.act_window',
    #         'name': 'OSCU Branches',
    #         'res_model': 'l10n_ke_edi_oscu.branch',
    #         'view_mode': 'tree,form',
    #     }
