# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models
from odoo.exceptions import UserError

def uninstall_hook(env):
    cr = env.cr
    cr.execute(
        """
            SELECT type
            FROM ir_attachment
            WHERE type = 'cloud_storage_google'
            LIMIT 1
        """)
    if cr.fetchone():
        raise UserError('Some Google attachments are in use, please migrate cloud storages before uninstall this module')
    cr.execute("""
        SELECT 1
        FROM cloud_storage_blob_to_delete
        LIMIT 1
    """)
    if cr.fetchone():
        raise UserError("Some deleted cloud_storage attachments' blobs are not deleted please manually clean them")

    env['ir.config_parameter'].sudo().set_param('cloud_storage_provider', False)
    env['ir.config_parameter'].sudo().search_fetch([('key', 'in', (
        'cloud_storage_google_bucket_name',
        'cloud_storage_google_account_info',
    ))], []).unlink()
