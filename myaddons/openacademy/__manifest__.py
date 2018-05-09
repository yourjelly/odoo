# -*- coding: utf-8 -*-
{
    'name': "OpenAcademy - DBE",

    'summary': """
        Openacademy is a simple module designed for training and customized by DBE.""",

    'description': """
        Manage course, classes, teachers, students, ... Great stuffs then !
    """,
    'application':True,

    'author': "Odoo - DBE",
    'website': "http://www.odoo.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/10.0/odoo/addons/base/module/module_data.xml
    # for the full list
    'category': 'Training',
    'version': '0.2',

    # any module necessary for this one to work correctly
    'depends': ['base','mail','website','board'],

    # always loaded
    'data': [
        # "security/security.xml",
        "security/ir.model.access.csv",
        "data/openacademy_data.xml",
        "data/controllers_templates.xml",
        "data/email_template.xml",
        "views/main.xml",
        "views/course_view.xml",
        "views/session_view.xml",
        "views/people_view.xml",
        "views/wizard.xml",
        "views/invoice_view.xml",
        "views/board.xml",
        "views/assets.xml",
        "reports/Qweb_report.xml",
    ],
    # only loaded in demonstration mode
    'demo': [],
}
