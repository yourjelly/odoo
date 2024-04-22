import requests
import xmlrpc.client
from lxml import etree
import asyncio
import logging

from itertools import islice
from urllib.parse import quote

# This is a script to manually clean up unused azure blobs.

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
# +--------+ 6. [202: Accepted, 404: Not Found]            +---------+
#
#
# 1, 2, 3, 4, 5, 6 are done in batch
# 5, 6 are done with asyncio

# Azure
X_MS_VERSION = '2023-11-03'
azure_container_name = 'container_name'
azure_account_name = 'account_name'
azure_tenant_id = 'tenant_id'
azure_client_id = 'client_id'
azure_client_secret = 'client_secret'

# Get OAuth token
azure_token_url = f"https://login.microsoftonline.com/{azure_tenant_id}/oauth2/token"
azure_token_data = {
    'grant_type': 'client_credentials',
    'client_id': azure_client_id,
    'client_secret': azure_client_secret,
    'resource': 'https://storage.azure.com/'
}
azure_token_response = requests.post(azure_token_url, data=azure_token_data)
azure_token = azure_token_response.json()['access_token']

# odoo
odoo_url = 'http://localhost:8069'
odoo_db = 'odoo_db'
odoo_username = 'admin'
odoo_password = 'admin'


def list_blob_urls(container_name, batch_size=1000):
    # List blobs
    url = f"https://{azure_account_name}.blob.core.windows.net/{container_name}?restype=container&comp=list"
    headers = {
        'Authorization': f'Bearer {azure_token}',
        'x-ms-version': X_MS_VERSION,
        'Content-Type': 'application/xml'
    }
    params = {
        'maxresults': batch_size,
    }
    blob_urls = []
    while True:
        response = requests.get(url, headers=headers, params=params, timeout=5)
        response_xml = etree.fromstring(response.content)
        blob_urls.extend(
            f"https://{azure_account_name}.blob.core.windows.net/{azure_container_name}/{quote(blob.find('Name').text)}"
            for blob in response_xml.findall('.//Blob')
        )

        params['marker'] = response_xml.find('NextMarker').text
        if params['marker'] is None:
            break

    return blob_urls


def get_blobs_to_be_deleted(blob_urls):
    common = xmlrpc.client.ServerProxy('{}/xmlrpc/2/common'.format(odoo_url))
    uid = common.authenticate(odoo_db, odoo_username, odoo_password, {})
    models = xmlrpc.client.ServerProxy('{}/xmlrpc/2/object'.format(odoo_url))
    attachments = models.execute_kw(odoo_db, uid, odoo_password, 'ir.attachment', 'search_read', [
        [('type', '=', 'cloud_storage_azure'), ('url', 'in', blob_urls)],
        ['url']
    ])
    used_urls = set(attachment['url'] for attachment in attachments)
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
            'Authorization': f'Bearer {azure_token}',
            'x-ms-version': X_MS_VERSION,
            'Content-Type': 'application/xml'
        }
        delete_response = requests.delete(blob_url, headers=headers, timeout=5)
        if delete_response.status_code not in (202, 404):
            logging.warning('Failed to delete blob %s: %s', blob_url, delete_response.text)

    loop = asyncio.get_event_loop()
    for blob_urls_ in split_every(batch_size, blob_urls):
        loop.run_until_complete(asyncio.gather(*[
            loop.run_in_executor(None, delete_blob_, blob_url)
            for blob_url in blob_urls_
        ]))


all_blob_urls = list_blob_urls(container_name=azure_container_name, batch_size=1000)
to_delete_blob_urls = get_blobs_to_be_deleted(all_blob_urls)
delete_blobs(to_delete_blob_urls)
