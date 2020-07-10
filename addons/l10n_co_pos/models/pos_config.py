# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    pos_serial_number = fields.Char(string="POS Serial Number")


class PosOrder(models.AbstractModel):
    _name = 'report.l10n_co_pos.report_saledetails'
    _inherit = 'report.point_of_sale.report_saledetails'
