# Part of Odoo. See LICENSE file for full copyright and licensing details.

from requests import Response
from unittest.mock import patch

from odoo.tests.common import TransactionCase


DUMMY_AZURE_CONNECTION_STRING = r'''DefaultEndpointsProtocol=https;AccountName=accountname;AccountKey=1234;EndpointSuffix=core.windows.net'''


class TestCloudStorageAzure(TransactionCase):

    def setUp(self):
        super().setUp()
        self.container_name = 'container_name'
        self.env['ir.config_parameter'].set_param('ir_attachment.cloud_storage', 'cloud.storage.azure')
        self.env['ir.config_parameter'].set_param(
            'cloud_storage_azure_connection_string', DUMMY_AZURE_CONNECTION_STRING
        )
        self.env['ir.config_parameter'].set_param('cloud_storage_azure_container_name', self.container_name)

        # create test cloud attachment like route "/mail/attachment/upload"
        # with dummy binary
        self.attachments = self.env['ir.attachment'].create([{
            'name': 'test.txt',
            'mimetype': 'text/plain',
            'datas': b'',
        }, {
            'name': 'test.png',
            'mimetype': 'image/png',
            'datas': b'',
        }])
        self.attachments._post_add_create(cloud_storage=True)

    def test_cloud_storage_azure_unlink_success(self):
        self.assertFalse(self.env['cloud.storage.blob.to.delete'].search_count([]))
        self.attachments.unlink()
        self.assertFalse(self.attachments.exists())
        self.assertEqual(self.env['cloud.storage.blob.to.delete'].search_count([]), 2)
        delete_num = 0

        def delete(url, **kwargs):
            nonlocal delete_num
            delete_num += 1
            response = Response()
            response.status_code = 202
            return response

        with patch('odoo.addons.cloud_storage_azure.models.cloud_storage_azure.requests.delete', delete):
            self.env['cloud.storage.blob.to.delete'].delete_blobs()

        self.assertEqual(delete_num, 2, '2 requests should be sent to the azure api')
        self.assertFalse(self.env['cloud.storage.blob.to.delete'].search_count([]), 'all blobs should be deleted')

    def test_cloud_storage_azure_unlink_notfound(self):
        # the attachment has been deleted in the cloud storage
        # or the attachment has never been uploaded to the cloud storage
        self.assertFalse(self.env['cloud.storage.blob.to.delete'].search([]))
        self.attachments.unlink()
        self.assertFalse(self.attachments.exists())
        self.assertEqual(self.env['cloud.storage.blob.to.delete'].search_count([]), 2)
        delete_num = 0

        def delete(url, **kwargs):
            nonlocal delete_num
            delete_num += 1
            response = Response()
            response.status_code = 404
            return response

        with patch('odoo.addons.cloud_storage_azure.models.cloud_storage_azure.requests.delete', delete):
            self.env['cloud.storage.blob.to.delete'].delete_blobs()

        self.assertEqual(delete_num, 2, '2 requests should be sent to the azure api')
        # Not Found exception should be ignored and all cloud.storage.blob.to.delete should be deleted
        self.assertFalse(self.env['cloud.storage.blob.to.delete'].search_count([]), 'all blobs should be deleted')

    def test_cloud_storage_azure_unlink_forbidden_blob(self):
        # current azure connection string cannot delete blobs in the container
        self.assertFalse(self.env['cloud.storage.blob.to.delete'].search([]))
        self.attachments.unlink()
        self.assertFalse(self.attachments.exists())
        self.assertEqual(self.env['cloud.storage.blob.to.delete'].search_count([]), 2)
        delete_num = 0

        def delete(url, **kwargs):
            nonlocal delete_num
            delete_num += 1
            response = Response()
            response.status_code = 202
            if 'test.txt' in url:
                response.status_code = 403
                response._content = bytes('forbidden', 'utf-8')
            return response

        with patch('odoo.addons.cloud_storage_azure.models.cloud_storage_azure.requests.delete', delete):
            self.env['cloud.storage.blob.to.delete'].delete_blobs()

        self.assertEqual(delete_num, 2, '2 requests should be sent to the azure api')
        blob = self.env['cloud.storage.blob.to.delete'].search([])
        self.assertEqual(len(blob), 1, 'the other blob should be deleted successfully')
        self.assertIn('test.txt', blob.url)
        self.assertEqual(blob.state, 'failed')
        self.assertEqual(blob.error_message, "Error: forbidden")

    def test_cloud_storage_azure_unlink_unknown_exception(self):
        # current azure connection string cannot delete blobs for unknown reason
        self.assertFalse(self.env['cloud.storage.blob.to.delete'].search([]))
        self.attachments.unlink()
        self.assertFalse(self.attachments.exists())
        self.assertEqual(self.env['cloud.storage.blob.to.delete'].search_count([]), 2)
        delete_num = 0

        def delete(url, **kwargs):
            nonlocal delete_num
            delete_num += 1
            response = Response()
            response.status_code = 202
            if 'test.txt' in url:
                response.status_code = 400
                response._content = bytes('unknown', 'utf-8')
            return response

        with patch('odoo.addons.cloud_storage_azure.models.cloud_storage_azure.requests.delete', delete):
            self.env['cloud.storage.blob.to.delete'].delete_blobs()

        self.assertEqual(delete_num, 2, '2 requests should be sent to the azure api')
        blob = self.env['cloud.storage.blob.to.delete'].search([])
        self.assertEqual(len(blob), 1, 'the other blob should be deleted successfully')
        self.assertIn('test.txt', blob.url)
        self.assertEqual(blob.state, 'failed')
        self.assertEqual(blob.error_message, "Error: unknown")

    def test_cloud_storage_azure_unlink_url_shared_attachments(self):
        self.attachments[0].copy()
        self.assertFalse(self.env['cloud.storage.blob.to.delete'].search_count([]))
        self.attachments.unlink()
        self.assertFalse(self.attachments.exists())
        self.assertEqual(self.env['cloud.storage.blob.to.delete'].search_count([]), 2)
        delete_num = 0

        def delete(url, **kwargs):
            nonlocal delete_num
            delete_num += 1
            response = Response()
            response.status_code = 202
            return response

        with patch('odoo.addons.cloud_storage_azure.models.cloud_storage_azure.requests.delete', delete):
            self.env['cloud.storage.blob.to.delete'].delete_blobs()

        self.assertEqual(delete_num, 1, "shared cloud storage blob shouldn't be deleted")
        self.assertFalse(self.env['cloud.storage.blob.to.delete'].search_count([]))
