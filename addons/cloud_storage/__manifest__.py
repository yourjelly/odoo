# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    "name": "Cloud Storage",
    "summary": """Store chatter attachments in the cloud""",
    "category": "Technical Settings",
    "version": "1.0",
    "depends": ["mail"],
    "data": [
        "data/ir_cron_data.xml",
        "security/ir.model.access.csv",
        "views/cloud_storage_blob_to_delete_views.xml",
        "views/settings.xml",
    ],
    'assets': {
            'web.assets_backend': [
                'cloud_storage/static/src/core/common/**/*',
            ],
            'mail.assets_public': [
                'cloud_storage/static/src/core/common/**/*',
            ],
    },
    'license': 'LGPL-3',
}
