# -*- coding: utf-8 -*-
{
    'name' : 'Import Vendor Bills From XML',
    'version' : '1.0',
    'category': 'Accounting',
    'depends' : ['account'],
    'data': [
        'data/facturx_templates.xml',
        'views/assets.xml',
        'views/import_invoice_xml_wizard_view.xml',
        'views/account_journal_dashboard_view.xml',
        'views/account_invoice_view.xml',
    ],
    'qweb': [
        'static/src/xml/import_xmls_view.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': True,
}
