# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from openerp import models, fields, api

class pos_config(models.Model):
    _inherit = 'pos.config'

    iface_blackbox_be = fields.Boolean("Belgian Fiscal Data Module", help="Enables integration with a Belgian Fiscal Data Module")
