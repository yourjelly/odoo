# Part of Odoo. See LICENSE file for full copyright and licensing details.

from requests.models import Response
from unittest.mock import patch

try:
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
except ImportError:
    service_account = Request = None

from odoo.tests.common import TransactionCase

DUMMY_GOOGLE_ACCOUNT_INFO = r'''
{
    "type": "service_account",
    "project_id": "project_id",
    "private_key_id": "1234",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCjmpzbYZQpiCSN\nQAw45TLENOyz27cPwY6hC3JD6ceHlblGpB4I2vVvRf7Qmv5Uv1oK7C5OfHUU7MmC\nfIaJfDlxciZrtTCCuCidm569tOgv57/DY+L3MFpQrIjSG2SiFO6LncqbZ74u4K7b\nABu3AheCFtZLGh0DyXA6wsv6tZuz4HC5UKDGEVc0wD8ZESmgPRXiY9IWKcEmRp3m\nbLv7gBT6j1zOrtLlxmU/gCzHPnBzJyPhl6Hxufj7Fmnkq84BfiMo8tEjQAIkS3RR\nSG7aP+GdOx1MEd5wKBT5bOrJX9+61CqAE6LupnTiAzt4iDDUQdRxaN1aQ3Q0MxrE\nzpRSawZbAgMBAAECggEALnN2KMWuSxJ4ClDOh5Lv1IyQTkrKUaNrqyb0VPr553Gn\nzrpHOs1sVSEjBbiUEJzZ5HMFfMxSc9P9LNrNWhjWuHKoHPmvYdYG1iT6r7M/H2bl\n6ASiyvtEEVbDbCBR9MELr8Fn5rLQaT/q9Yw00kO6R/nS8zThWxNlFZH8V10b7biN\na6EQr8udA4zUhYy+m3bnX47kBWFmXp8zJl4zHm70eT+WDurN8O3oMqcimozWFnsz\nT4QTJn6WKoVKQ5CAHRTf9iRH0FFzeWLkNZQmYY4pEljKajgvGyfQfAKXWuRIveGQ\nI5TOwvbDNtb+bDdvzD/hFi0EhjKGrV97yqdcvNHPOQKBgQDkn1lEu2V741tMa6s+\n80KySMfynJ4yH0KSR+NGp4jhVqP6MKL5imk9TO5E9WwrNrQjJErnmblURp6SnZPL\nrXi8ngmFq6Bdp+jMtpdlZZa5zKryGyyfDABrHZTSVXZloP1qA0DO45uFfH0b137W\nJsELXHNUx2u/jBraoOK0W/rXAwKBgQC3Mg537ImTHUEJ81GmL591YDGNBR68uVS2\nB866v5z+E/oIfUbhFeqHyMFPzJnf/MfWQImv1O9HWWtDJgJhFaZcRaocvn5mQRj6\n2Mhpgq+1nD5oqT+JRDXPw6ESmxz8E4wddF68BmYrDKUjGZsT3sSEkRoertpc2Sc1\nwhK4xVJnyQKBgAcyWO4H9B7dPk9+iCp4H95a2ihx86ziPQc7yhS8S1vEjW7fvxGZ\n4Mw0Mr/q9de6ZhtBFjaKKUJU4sL8wN1Ffap6UxRpHag1E+f1y3g+pWr93Ve3sUTk\nbNLyYG/qjsqOMcv3hD++/HNMQufwdaaqG6OO6nZ9vI+QCnxdWiWRS6kfAoGAV+6F\n9VgrHNsg2cbZ/RvEvVFD132KqGmI2KrcttS8ZVRvYl3HhMjBPxXEfCon/dRWk2d8\n71IU3Dl2e8+lurXqmUWzBoMFJs2+UMF3SPW6o0Bw0EnUvm1oKuaqzMR5YCF90rGF\nu1iS97zlEvj6b8owp7UCRZIGLCTrZilWVSwZhskCgYEA43vM7PzBf7FZANZEaZlz\nt4LjgJMLEfUeL7XULqx5jNqR9oLNFANgHRr1t/NknJsrmg/8BUEK39Xs9qz7Vkkh\nanXqyrE2o65I7a6AMXostCDmBeIhk4diYAZARWtPLTHf5YCb0N7/llOmmx3rDP+r\n8Ij56mh2K6CodWbFby9GjNY=\n-----END PRIVATE KEY-----\n",
    "client_email": "account@project_id.iam.gserviceaccount.com",
    "client_id": "1234",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/account%40project_id.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
}
'''


class TestCloudStorageGoogle(TransactionCase):

    def setUp(self):
        if not service_account:
            self.skipTest('google.oauth2 is not installed')
        super().setUp()
        self.bucket_name = 'bucket_name'
        self.env['ir.config_parameter'].set_param('cloud_storage_provider', 'google')
        self.env['ir.config_parameter'].set_param('cloud_storage_google_bucket_name', self.bucket_name)
        self.env['ir.config_parameter'].set_param('cloud_storage_google_account_info', DUMMY_GOOGLE_ACCOUNT_INFO)

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

    def test_cloud_storage_google_unlink_success(self):
        self.assertFalse(self.env['cloud.storage.blob.to.delete'].search_count([]))
        self.attachments.unlink()
        self.assertFalse(self.attachments.exists())
        self.assertEqual(self.env['cloud.storage.blob.to.delete'].search_count([]), 2)
        delete_num = 0

        def delete(url, **kwargs):
            nonlocal delete_num
            delete_num += 1
            response = Response()
            response.status_code = 204
            return response

        with patch('odoo.addons.cloud_storage_google.models.cloud_storage_google.requests.delete', delete):
            self.env['cloud.storage.blob.to.delete'].delete_blobs()

        self.assertEqual(delete_num, 2, '2 requests should be sent to the google api')
        self.assertFalse(self.env['cloud.storage.blob.to.delete'].search_count([]), 'all blobs should be deleted')

    def test_cloud_storage_google_unlink_notfound(self):
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

        with patch('odoo.addons.cloud_storage_google.models.cloud_storage_google.requests.delete', delete):
            self.env['cloud.storage.blob.to.delete'].delete_blobs()

        self.assertEqual(delete_num, 2, '2 requests should be sent to the google api')
        # Not Found exception should be ignored and all cloud.storage.blob.to.delete should be deleted
        self.assertFalse(self.env['cloud.storage.blob.to.delete'].search_count([]), 'all blobs should be deleted')

    def test_cloud_storage_google_unlink_forbidden_blob(self):
        # current google account info cannot delete blobs in the bucket
        self.assertFalse(self.env['cloud.storage.blob.to.delete'].search([]))
        self.attachments.unlink()
        self.assertFalse(self.attachments.exists())
        self.assertEqual(self.env['cloud.storage.blob.to.delete'].search_count([]), 2)
        delete_num = 0

        def delete(url, **kwargs):
            nonlocal delete_num
            delete_num += 1
            response = Response()
            response.status_code = 204
            if 'test.txt' in url:
                response.status_code = 403
                response._content = bytes('forbidden', 'utf-8')
            return response

        with patch('odoo.addons.cloud_storage_google.models.cloud_storage_google.requests.delete', delete):
            self.env['cloud.storage.blob.to.delete'].delete_blobs()

        self.assertEqual(delete_num, 2, '2 requests should be sent to the google api')
        blob = self.env['cloud.storage.blob.to.delete'].search([])
        self.assertEqual(len(blob), 1, 'the other blob should be deleted successfully')
        self.assertIn('test.txt', blob.url)
        self.assertEqual(blob.state, 'failed')
        self.assertEqual(blob.error_message, "Error: forbidden")

    def test_cloud_storage_google_unlink_unknown_exception(self):
        # current google account info cannot delete blobs for unknown reason
        self.assertFalse(self.env['cloud.storage.blob.to.delete'].search([]))
        self.attachments.unlink()
        self.assertFalse(self.attachments.exists())
        self.assertEqual(self.env['cloud.storage.blob.to.delete'].search_count([]), 2)
        delete_num = 0

        def delete(url, **kwargs):
            nonlocal delete_num
            delete_num += 1
            response = Response()
            response.status_code = 204
            if 'test.txt' in url:
                response.status_code = 400
                response._content = bytes('unknown', 'utf-8')
            return response

        with patch('odoo.addons.cloud_storage_google.models.cloud_storage_google.requests.delete', delete):
            self.env['cloud.storage.blob.to.delete'].delete_blobs()

        self.assertEqual(delete_num, 2, '2 requests should be sent to the google api')
        blob = self.env['cloud.storage.blob.to.delete'].search([])
        self.assertEqual(len(blob), 1, 'the other blob should be deleted successfully')
        self.assertIn('test.txt', blob.url)
        self.assertEqual(blob.state, 'failed')
        self.assertEqual(blob.error_message, "Error: unknown")

    def test_cloud_storage_google_unlink_url_shared_attachments(self):
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
            response.status_code = 204
            return response

        with patch('odoo.addons.cloud_storage_google.models.cloud_storage_google.requests.delete', delete):
            self.env['cloud.storage.blob.to.delete'].delete_blobs()

        self.assertEqual(delete_num, 1, "shared cloud storage blob shouldn't be deleted")
        self.assertFalse(self.env['cloud.storage.blob.to.delete'].search_count([]))
