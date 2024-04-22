# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, _
from odoo.exceptions import UserError

from odoo.addons.cloud_storage.models.ir_attachment import DEFAULT_CLOUD_STORAGE_MIN_FILE_SIZE


class CloudStorageSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    cloud_storage_provider = fields.Selection(selection_add=[('google', 'Google Cloud Storage')])

    cloud_storage_google_bucket_name = fields.Char(
        string='Google Bucket Name',
        config_parameter='cloud_storage_google_bucket_name')
    cloud_storage_google_account_info = fields.Char(
        string='Google Account Info',
        config_parameter='cloud_storage_google_account_info')
