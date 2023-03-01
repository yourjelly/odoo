# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models
from odoo.addons.http_routing.models.ir_http import slug


class PosConfig(models.Model):
    _inherit = "pos.config"

    self_order_view_mode = fields.Boolean(
        string="QR Code Menu",
        help="Allow customers to view the menu on their phones by scanning the QR code on the table",
    )
    self_order_image = fields.Binary(
        string="Self Order Image",
        help="Image to display on the self order screen",
    )
    self_order_image_name = fields.Char(
        string="Self Order Image Name",
        help="Name of the image to display on the self order screen",
    )

    def preview_self_order_app(self):
        """
        This function is called when the user clicks on the "Preview App" button
        :return: object representing the action to open the app's url in a new tab
        """
        self.ensure_one()
        return {
            "type": "ir.actions.act_url",
            "url": f"/menu/{slug(self)}",
            "target": "new",
        }
