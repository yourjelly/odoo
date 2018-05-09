# -*- coding: utf-8 -*-
{
    'name': "Cooperative Management",

    'summary': """
        Cooperative management""",

    'description': """
        Manage a cooperative group 
    """,
    'application':True,

    'author': "Odoo",
    'website': "http://www.odoo.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/10.0/odoo/addons/base/module/module_data.xml
    # for the full list
    'category': 'Training',
    'version': '0.1',

    # any module necessary for this one to work correctly
    'depends': ['base'],

    # always loaded
    'data': [
        "security/ir.model.access.csv",
        "data/coop_data.xml",
        "data/task_template.xml",
        "data/partners_data.xml",
        "views/task_template_view.xml",
        "views/task_view.xml",
        "views/partner_view.xml",
        "views/config_view.xml",
        "reports/Qweb_report.xml",
        "reports/solution.xml",
    ],
    # only loaded in demonstration mode
    'demo': [],
}
