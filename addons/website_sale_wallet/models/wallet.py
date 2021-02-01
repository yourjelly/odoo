# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class Wallet(models.Model):
    _inherit = ['website.multi.mixin', 'wallet']
    _name = "wallet"
