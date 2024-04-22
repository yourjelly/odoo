# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.addons.cloud_storage.models.ir_attachment import DEFAULT_CLOUD_STORAGE_MIN_FILE_SIZE


class IrHttp(models.AbstractModel):
    _inherit = 'ir.http'

    def session_info(self):
        res = super().session_info()
        if self.env['ir.config_parameter'].sudo().get_param('cloud_storage_provider'):
            res['cloud_storage_min_file_size'] = self.env['ir.config_parameter'].sudo().get_param('cloud_storage_min_file_size', DEFAULT_CLOUD_STORAGE_MIN_FILE_SIZE)
        return res
