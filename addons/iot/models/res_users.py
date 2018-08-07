# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResUsers(models.Model):
    _inherit = 'res.users'

    group_iot_user = fields.Selection(
        selection=lambda self: self._get_group_selection('iot.module_category_iot'),
        string='IoT', compute='_compute_groups_id', inverse='_inverse_groups_id',
        category_xml_id='iot.module_category_iot',
        help='Officer: The IoT user uses the IoT devices\nManager: The IoT manager can adapt and remove devices')