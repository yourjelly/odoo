# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, _
from odoo.exceptions import UserError

from odoo.addons.cloud_storage.models.ir_attachment import DEFAULT_CLOUD_STORAGE_MIN_FILE_SIZE


class CloudStorageSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    cloud_storage_azure_container_name = fields.Char(
        string='Azure Container Name',
        config_parameter='cloud_storage_azure_container_name')
    cloud_storage_azure_account_name = fields.Char(
        string='Azure Account Name',
        config_parameter='cloud_storage_azure_account_name')
    cloud_storage_azure_tenant_id = fields.Char(
        string='Azure Tenant ID',
        config_parameter='cloud_storage_azure_tenant_id')
    cloud_storage_azure_client_id = fields.Char(
        string='Azure Client ID',
        config_parameter='cloud_storage_azure_client_id')
    cloud_storage_azure_client_secret = fields.Char(
        string='Azure Client Secret',
        config_parameter='cloud_storage_azure_client_secret')

    def set_values(self):
        azure_container_name_before = self.env['ir.config_parameter'].get_param('cloud_storage_azure_container_name')
        azure_account_name_before = self.env['ir.config_parameter'].get_param('cloud_storage_azure_account_name')
        azure_tenant_id_before = self.env['ir.config_parameter'].get_param('cloud_storage_azure_tenant_id')
        azure_client_id_before = self.env['ir.config_parameter'].get_param('cloud_storage_azure_client_id')
        azure_client_secret_before = self.env['ir.config_parameter'].get_param('cloud_storage_azure_client_secret')
        super().set_values()
        if all((
            self.cloud_storage_azure_container_name,
            self.cloud_storage_azure_account_name,
            self.cloud_storage_azure_tenant_id,
            self.cloud_storage_azure_client_id,
            self.cloud_storage_azure_client_secret,
        )) and any((
            self.cloud_storage_azure_container_name != azure_container_name_before,
            self.cloud_storage_azure_account_name != azure_account_name_before,
            self.cloud_storage_azure_tenant_id != azure_tenant_id_before,
            self.cloud_storage_azure_client_id != azure_client_id_before,
            self.cloud_storage_azure_client_secret != azure_client_secret_before,
        )):
            self.env['cloud.storage.provider']._setup()
