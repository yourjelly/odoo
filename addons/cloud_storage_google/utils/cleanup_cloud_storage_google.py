import requests
import xmlrpc.client
import asyncio
import json
import logging

from itertools import islice
from google.oauth2 import service_account
from google.auth.transport.requests import Request
from urllib.parse import quote

# This is a script to manually clean up unused google blobs.

# +--------+ 3. search_read ir.attachments with cloud urls +---------+
# |        | --------------------------------------------> |         |
# |        | <-------------------------------------------- |  Odoo   |
# |        | 4. used urls                                  |         |
# |        |                                               |         |
# | Script |                                               +---------+
# |        |                                               +---------+
# |        |                            1. list all blobs  |  Cloud  |
# |        | --------------------------------------------> | Storage |
# |        | <-------------------------------------------- |         |
# |        | 2. blobs names                                |         |
# |        |                                               |         |
# |        |                        5. delete unused blobs |         |
# |        | --------------------------------------------> |         |
# |        | <-------------------------------------------- |         |
# +--------+ 6. [204: No Content, 404: Not Found]          +---------+
#
#
# 1, 2, 3, 4, 5, 6 are done in batch
# 5, 6 are done with asyncio

# google service account
GOOGLE_CLOUD_STORAGE_ENDPOINT = 'https://storage.googleapis.com'
google_cloud_bucket_name = 'bucket_name'
google_cloud_account_info = r"""account_info"""
google_cloud_account_info = json.loads(google_cloud_account_info)

credentials = service_account.Credentials.from_service_account_info(google_cloud_account_info).with_scopes(
    ['https://www.googleapis.com/auth/devstorage.full_control'])
credentials.refresh(Request())

# odoo
odoo_url = 'http://localhost:8069'
odoo_db = 'odoo_db'
odoo_username = 'admin'
odoo_password = 'admin'


def list_blob_urls(bucket_name, batch_size=1000):
    url = f"https://www.googleapis.com/storage/v1/b/{bucket_name}/o"
    params = {
        'maxResults': batch_size,
        'fields': 'items(name), nextPageToken',
    }
    headers = {
        'Authorization': f"Bearer {credentials.token}"
    }

    blob_urls = []

    while True:
        response = requests.get(url, params=params, headers=headers, timeout=5)
        data = response.json()
        blob_urls.extend(
            f'{GOOGLE_CLOUD_STORAGE_ENDPOINT}/{bucket_name}/{quote(blob["name"])}'
            for blob in data.get('items', [])
        )

        if not (next_page_token := data.get('nextPageToken')):
            break
        params['pageToken'] = next_page_token

    return blob_urls


def get_blobs_to_be_deleted(blob_urls):
    common = xmlrpc.client.ServerProxy(f'{odoo_url}/xmlrpc/2/common')
    uid = common.authenticate(odoo_db, odoo_username, odoo_password, {})
    models = xmlrpc.client.ServerProxy(f'{odoo_url}/xmlrpc/2/object')
    attachments = models.execute_kw(odoo_db, uid, odoo_password, 'ir.attachment', 'search_read', [
        [('type', '=', 'cloud_storage_google'), ('url', 'in', blob_urls)],
        ['url']
    ])
    used_urls = {attachment['url'] for attachment in attachments}
    return [blob_url for blob_url in blob_urls if blob_url not in used_urls]


def split_every(n, iterable, piece_maker=tuple):
    iterator = iter(iterable)
    piece = piece_maker(islice(iterator, n))
    while piece:
        yield piece
        piece = piece_maker(islice(iterator, n))


def delete_blobs(blob_urls, batch_size=1000):
    def delete_blob_(blob_url):
        headers = {
            'Authorization': f"Bearer {credentials.token}"
        }
        delete_response = requests.delete(blob_url, headers=headers, timeout=5)
        if delete_response.status_code not in (204, 404):
            logging.warning('Failed to delete blob %s: %s', blob_url, delete_response.text)

    loop = asyncio.get_event_loop()
    for blob_urls_ in split_every(batch_size, blob_urls):
        loop.run_until_complete(asyncio.gather(*[
            loop.run_in_executor(None, delete_blob_, blob_url)
            for blob_url in blob_urls_
        ]))


all_blob_urls = list_blob_urls(bucket_name=google_cloud_bucket_name, batch_size=1000)
to_delete_blob_urls = get_blobs_to_be_deleted(all_blob_urls)
delete_blobs(to_delete_blob_urls)
