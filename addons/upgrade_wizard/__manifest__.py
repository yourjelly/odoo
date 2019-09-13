# -*- coding: utf-8 -*-
{
    'name': "UpgradeW izard",
    'summary': """Upgrade Wizard""",
    'description': """Maximise chances to have a nice upgrade process""",
    'author':      "Odoo S.A.",
    'website':     "http://www.odoo.com",
    'version':     '0.1',
    'depends':     ['base'],
    'data':        [
        'security/ir.model.access.csv',
        'views/upgrade_wizard_views.xml',
        'data/check_data.xml',
        'data/actions.xml',
        ],
    'demo':        [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
