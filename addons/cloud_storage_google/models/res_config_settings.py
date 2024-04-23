# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class CloudStorageSettings(models.TransientModel):
    """
    Instructions:
    cloud_storage_google_bucket_name: if changed and the old bucket name
        are still in use, you should promise the current service account
        has the permission to access the old bucket.
    """
    _inherit = 'res.config.settings'

    cloud_storage_provider = fields.Selection(selection_add=[('google', 'Google Cloud Storage')])

    cloud_storage_google_bucket_name = fields.Char(
        string='Google Bucket Name',
        config_parameter='cloud_storage_google_bucket_name')
    # Service Account Info in JSON format
    cloud_storage_google_account_info = fields.Char(
        string='Google Account Info',
        config_parameter='cloud_storage_google_account_info')
