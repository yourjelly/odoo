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

    cloud_storage_google_bucket_name = fields.Char(
        string='Google Bucket Name',
        config_parameter='cloud_storage_google_bucket_name')
    cloud_storage_google_account_info = fields.Char(
        string='Google Account Info',
        config_parameter='cloud_storage_google_account_info')

    cloud_storage_provider = fields.Selection(
        selection='_get_cloud_storage_providers',
        help='''The cloud storage provider to use for storing some attachments.
        Note: The unselected Cloud Storage Provider means you won't upload
        attachment to the cloud storage but the ORM will still try to use your
        previously provided token to delete cloud blobs for those uploaded
        ir.attachment records when they are unlinked.''',
    )
    cloud_storage_min_file_size = fields.Integer(
        string='Minimum File Size (bytes)',
        help='''webclient can upload files larger than the minimum file size
        (in bytes) as url attachments to the server and then upload the file to
        the cloud storage.''',
        config_parameter='cloud_storage_min_file_size',
        default=DEFAULT_CLOUD_STORAGE_MIN_FILE_SIZE,
    )

    def _get_cloud_storage_providers(self):
        return self.env['cloud.storage.provider']._get_all_providers()

    def get_values(self):
        res = super().get_values()
        res['cloud_storage_provider'] = self.env['ir.config_parameter'].get_param('ir_attachment.cloud_storage')
        return res

    def set_values(self):
        azure_container_name_before = self.env['ir.config_parameter'].get_param('cloud_storage_azure_container_name')
        azure_connection_string_before = self.env['ir.config_parameter'].get_param('cloud_storage_azure_connection_string')
        google_bucket_name_before = self.env['ir.config_parameter'].get_param('cloud_storage_google_bucket_name')
        google_account_info_before = self.env['ir.config_parameter'].get_param('cloud_storage_google_account_info')
        super().set_values()
        self.env['ir.config_parameter'].set_param('ir_attachment.cloud_storage', self.cloud_storage_provider)
        if self.cloud_storage_provider and not self.env[self.cloud_storage_provider]._is_configured():
            raise UserError(_('Please configure the cloud storage provider before enabling it.'))
        if self.cloud_storage_azure_connection_string and (
                self.cloud_storage_azure_connection_string != azure_connection_string_before or
                self.cloud_storage_azure_container_name != azure_container_name_before):
            self.env['cloud.storage.azure']._setup()
        if self.cloud_storage_google_account_info and (
                self.cloud_storage_google_account_info != google_account_info_before or
                self.cloud_storage_google_bucket_name != google_bucket_name_before):
            self.env['cloud.storage.google']._setup()
