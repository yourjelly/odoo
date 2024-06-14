# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class IrBinary(models.AbstractModel):
    _inherit = "ir.binary"

    def _find_record_check_access(self, record, access_token, field):
        if record._name == "pos.config" and field == "iface_customer_facing_display_background_image_1920":
            return record.sudo()
        return super()._find_record_check_access(record, access_token, field)
