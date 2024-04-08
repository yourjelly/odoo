# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, _
from odoo.exceptions import UserError

from odoo.addons.cloud_storage.models.ir_attachment import DEFAULT_CLOUD_STORAGE_MIN_FILE_SIZE


class CloudStorageSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    cloud_storage_azure_container_name = fields.Char(
        string='Azure Container Name',
        config_parameter='cloud_storage_azure_container_name')
    cloud_storage_azure_connection_string = fields.Char(
        string='Azure Connection String',
        config_parameter='cloud_storage_azure_connection_string')

    def set_values(self):
        azure_container_name_before = self.env['ir.config_parameter'].get_param('cloud_storage_azure_container_name')
        azure_connection_string_before = self.env['ir.config_parameter'].get_param('cloud_storage_azure_connection_string')
        super().set_values()
        if self.cloud_storage_azure_connection_string and (
                self.cloud_storage_azure_connection_string != azure_connection_string_before or
                self.cloud_storage_azure_container_name != azure_container_name_before):
            self.env['cloud.storage.provider']._setup()
