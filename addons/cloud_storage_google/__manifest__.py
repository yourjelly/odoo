# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    "name": "Cloud Storage Google",
    "summary": """Store chatter attachments in the Google cloud""",
    "category": "Technical Settings",
    "version": "1.0",
    "depends": ["cloud_storage"],
    "data": [
        "views/settings.xml",
    ],
    # "excludes": ["cloud_storage_azure"],
    "uninstall_hook": "uninstall_hook",
    'license': 'LGPL-3',
}
