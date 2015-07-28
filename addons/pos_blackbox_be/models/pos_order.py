# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from openerp import models, fields, api

class pos_order(models.Model):
    _inherit = 'pos.order'

    # todo jov: add the things that will be coming back from the FDM as fields
