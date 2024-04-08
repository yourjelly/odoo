# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, _
from odoo.exceptions import UserError
from odoo.tools import SQL, OrderedSet


# maximum attachment size: 20MB for Outlook, 25MB for Gmail and Yahoo
DEFAULT_CLOUD_STORAGE_MIN_FILE_SIZE = 20 * (10 ** 6)


class CloudStorageProvider(models.AbstractModel):
    _name = 'cloud.storage.provider'
    _description = 'Cloud Storage Provider'

    # Implement the following methods for each cloud storage provider.
    _cloud_storage_type = None

    def _setup(self):
        """
        Setup the cloud storage provider and check the validity of the account
        info after saving the config in settings
        return: None
        """
        raise NotImplementedError()

    def _is_configured(self):
        """
        Check if the cloud storage provider is configured
        :return: True if the cloud storage provider is configured else False
        """
        return False

    def _generate_url(self, attachment):
        """
        Generate a cloud blob url without signature or token for the attachment.
        This url is only used to identify the cloud blob.
        :param attachment: an ir.attachment record
        :return: A cloud blob url str
        """
        raise NotImplementedError()

    def _generate_download_info(self, attachment):
        """
        Generate the download info for the public client to directly download
        the attachment's blob from the cloud storage.
        :param attachment: an ir.attachment record
        :return: An download_info dictionary containing:
            * download_url: cloud storage url with permission to download the file
            * time_to_expiry: the time in seconds before the download url expires
        """
        raise NotImplementedError()

    def _generate_upload_info(self, attachment):
        """
        Generate the upload info for the public client to directly upload a
        file to the cloud storage.
        :param attachment: an ir.attachment record
        :return: An upload_info dictionary containing:
            * upload_url: cloud storage url with permission to upload the file
            * method: the request method used to upload the file
            * [Optionally] headers: a dictionary of headers to be added to the
                upload request
        """
        raise NotImplementedError()

    def _delete_blobs(self, blobs):
        """
        delete the cloud storage blobs corresponding to the given
        cloud.storage.blob.to.delete records.
        If a deletion succeeds, cleanup the corresponding record
        If a deletion fails, set the state of the corresponding record's state
        to 'failed' and record the error_message
        """
        raise NotImplementedError()

    def _generate_blob_name(self, attachment):
        """
        Generate a unique blob name for the attachment
        :param attachment: an ir.attachment record
        :return: A unique blob name str
        """
        return f'{attachment.id}/{attachment.name}'


class CloudStorageAttachment(models.Model):
    _inherit = 'ir.attachment'

    @property
    def CLOUD_STORAGE(self):
        """ check if current used cloud storage provider is configured """
        return self.env['cloud.storage.provider'].sudo()._is_configured()

    def unlink(self):
        # logically delete the cloud storage blobs before unlinking the
        # attachments. The cloud storage blobs will be deleted by cron job
        # ``ir_cron_cloud_storage_blobs_delete_action``
        self.env['cloud.storage.blob.to.delete'].sudo().create([{
            'url': attach.url,
        } for attach in self if attach.type.startswith('cloud_storage_')])
        return super().unlink()

    def _post_add_create(self, **kwargs):
        super()._post_add_create(**kwargs)
        if kwargs.get('cloud_storage'):
            if not self.CLOUD_STORAGE:
                raise UserError(_('Cloud Storage is not configured'))
            for record in self:
                record.write({
                    'raw': False,
                    'type': self.env['cloud.storage.provider']._cloud_storage_type,
                    'url': self.env['cloud.storage.provider']._generate_url(record)
                })


class CloudStorageBlobToDelete(models.Model):
    _name = 'cloud.storage.blob.to.delete'
    _description = "Cloud Storage blobs to delete"

    url = fields.Char('URL', required=True)
    state = fields.Selection([
        ('to_delete', 'To be deleted'),
        ('failed', 'Failed'),
    ], string='State', default='to_delete', required=True)
    error_message = fields.Text('Error Message')

    def delete_blobs(self):
        """
        Delete the blobs in the cloud storage
        mode: 'recordset' called by rpc when self.ids is not empty
            delete the blobs for the records in self
        mode: 'model' called by cron when self.ids is empty
            delete the blobs for a small batch of records for all records
        Note: the bottleneck of this method can be the `_delete_blobs` method
        of the cloud storage provider. If there is a timeout, some cloud blobs
        may have been deleted in the cloud but not in this model's table.
        It is acceptable, because these remained data will be cleaned by the
        future cron job ``ir_cron_cloud_storage_blobs_delete_action``
        """
        if len(self) > 100:
            raise UserError(_('Too many blobs to delete at once'))

        self.invalidate_model()
        self.env['ir.attachment'].flush_model()

        to_delete_condition = SQL('blob.id IN %s', tuple(self.ids)) if self.ids else SQL('1 = 1')

        # don't delete blobs if they are still used by ir.attachment records
        self.env.cr.execute(SQL(
            """
            DELETE FROM cloud_storage_blob_to_delete blob
            USING ir_attachment ia
            WHERE blob.url = ia.url
            AND %(to_delete_condition)s
            """,
            to_delete_condition=to_delete_condition,
        ))

        # remove blobs for not configured providers
        if not self.env['cloud.storage.provider'].sudo()._is_configured():
            self.env.cr.execute(SQL(
                """
                UPDATE cloud_storage_blob_to_delete blob
                SET state = 'failed',
                    error_message = 'Cloud Storage Provider not found'
                WHERE %(to_delete_condition)s
                """,
                to_delete_condition=to_delete_condition,
            ))
            return

        to_delete = self or self.search([('state', '=', 'to_delete')], limit=100)
        self.env['cloud.storage.provider']._delete_blobs(to_delete)
