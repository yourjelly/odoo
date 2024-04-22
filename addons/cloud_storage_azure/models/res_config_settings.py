# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, _
from odoo.exceptions import UserError

from odoo.addons.cloud_storage.models.ir_attachment import DEFAULT_CLOUD_STORAGE_MIN_FILE_SIZE


class CloudStorageSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    cloud_storage_provider = fields.Selection(selection_add=[('azure', 'Azure Cloud Storage')])

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
