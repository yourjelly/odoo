# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import re
import requests
from urllib.parse import unquote, quote

try:
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
except ImportError:
    service_account = Request = None

from odoo import models, fields, _
from odoo.exceptions import ValidationError
from odoo.tools import ormcache

from .cloud_storage_google_utils import generate_signed_url_v4

GOOGLE_CLOUD_STORAGE_ENDPOINT = 'https://storage.googleapis.com'


class CloudStorageGoogle(models.AbstractModel):
    _inherit = 'cloud.storage.provider'
    _description = 'Google Cloud Storage'

    _cloud_storage_type = 'cloud_storage_google'
    _url_pattern = re.compile(rf'{GOOGLE_CLOUD_STORAGE_ENDPOINT}/(?P<bucket_name>[\w\-.]+)/(?P<blob_name>[^?]+)')

    def _get_info_from_url(self, url):
        match = self._url_pattern.match(url)
        return {
            'bucket_name': match.group('bucket_name'),
            'blob_name': unquote(match.group('blob_name')),
        }

    def _generate_signed_url(self, bucket_name, blob_name, **kwargs):
        quote_blob_name = quote(blob_name)
        resource = f'/{bucket_name}/{quote_blob_name}'
        if 'expiration' not in kwargs:
            kwargs['expiration'] = 300
        return generate_signed_url_v4(
            credentials=self._get_credentials(),
            resource=resource,
            api_access_endpoint=GOOGLE_CLOUD_STORAGE_ENDPOINT,
            **kwargs,
        )

    @ormcache()
    def _get_credentials(self):
        """ Get the credentials object of currently used account info.
        This method is cached to because from_service_account_info is slow.
        """
        account_info = json.loads(self.env['ir.config_parameter'].sudo().get_param('cloud_storage_google_account_info'))
        credentials = service_account.Credentials.from_service_account_info(account_info)
        return credentials

    # OVERRIDES
    def _setup(self):
        # check bucket access
        bucket_name = self.env['ir.config_parameter'].sudo().get_param('cloud_storage_google_bucket_name')
        blob_name = '0/abc~_ *@ ¥®°²Æçéðπ⁉€∇⓵▲☑♂♥✓➔『にㄅ㊀中한︸🌈🌍👌😀-3.txt'

        upload_url = self._generate_signed_url(bucket_name, blob_name, method='PUT')
        upload_response = requests.put(upload_url, data=b'', timeout=5)
        if upload_response.status_code != 200:
            raise ValidationError(_('The account info is not allowed to access the bucket.\n%s', str(upload_response.text)))

        # check blob create and delete permission
        delete_url = self._generate_signed_url(bucket_name, blob_name, method='DELETE')
        delete_response = requests.delete(delete_url, timeout=5)
        if delete_response.status_code != 204:
            raise ValidationError(_('The account info is not allowed to delete a blob from the bucket.\n%s', str(delete_response.text)))

        # CORS management is not allowed in the Google Cloud console.
        # configure CORS on bucket to allow .pdf preview and direct upload
        cors = [{
            'origin': ['*'],
            'method': ['GET', 'PUT'],
            'responseHeader': ['Content-Type'],
            'maxAgeSeconds': 300,
        }]
        credentials = self._get_credentials().with_scopes(['https://www.googleapis.com/auth/devstorage.full_control'])
        credentials.refresh(Request())
        url = f"{GOOGLE_CLOUD_STORAGE_ENDPOINT}/storage/v1/b/{bucket_name}?fields=cors"
        headers = {
            'Authorization': f'Bearer {credentials.token}',
            'Content-Type': 'application/json'
        }
        data = json.dumps({'cors': cors})
        patch_response = requests.patch(url, data=data, headers=headers, timeout=5)
        if patch_response.status_code != 200:
            raise ValidationError(_('The account info is not allowed to set the bucket CORS.\n%s', str(patch_response.text)))

        # promise the signed url can be matched correctly
        signed_url = self._generate_signed_url(bucket_name, blob_name)
        try:
            info = self._get_info_from_url(signed_url)
            assert info['bucket_name'] == bucket_name
            assert info['blob_name'] == blob_name
        except Exception as e:
            raise ValidationError(_('The signed url cannot be matched correctly.\n%s', str(e)))

    def _is_configured(self):
        return bool(self.env['ir.config_parameter'].sudo().get_param('cloud_storage_google_account_info'))

    def _generate_url(self, attachment):
        blob_name = self._generate_blob_name(attachment)
        bucket_name = self.env['ir.config_parameter'].sudo().get_param('cloud_storage_google_bucket_name')
        return f"{GOOGLE_CLOUD_STORAGE_ENDPOINT}/{bucket_name}/{quote(blob_name)}"

    def _generate_download_info(self, attachment):
        info = self._get_info_from_url(attachment.url)
        time_to_expiry = 300
        return {
            'url': self._generate_signed_url(info['bucket_name'], info['blob_name'], method='GET', expiration=time_to_expiry),
            'time_to_expiry': time_to_expiry,
        }

    def _generate_upload_info(self, attachment):
        info = self._get_info_from_url(attachment.url)
        time_to_expiry = 300
        return {
            'url': self._generate_signed_url(info['bucket_name'], info['blob_name'], method='PUT', expiration=time_to_expiry),
            'method': 'PUT',
        }

    def _delete_blobs(self, blobs):
        deleted_blob_ids = []
        for blob in blobs:
            info = self._get_info_from_url(blob.url)
            url = self._generate_signed_url(info['bucket_name'], info['blob_name'], method='DELETE')
            response = requests.delete(url, timeout=5)
            if response.status_code not in [204, 404]:  # [204: No Content, 404: Not Found]
                blob.write({
                    'state': 'failed',
                    'error_message': f'Error: {response.text}',
                })
            else:
                deleted_blob_ids.append(blob.id)
        blobs.browse(deleted_blob_ids).unlink()


class CloudStorageAttachment(models.Model):
    _inherit = 'ir.attachment'

    type = fields.Selection(
        selection_add=[(CloudStorageGoogle._cloud_storage_type, CloudStorageGoogle._description)],
        ondelete={CloudStorageGoogle._cloud_storage_type: lambda recs: recs.write({'type': 'url'})}
    )
