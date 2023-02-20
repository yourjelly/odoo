# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'Delivery Costs',
    'version': '1.0',
    'category': 'Delivery',
    'description': """
Allows you to add delivery costs.
""",
    'depends': ['sale'],
    'data': [
        'security/ir.model.access.csv',
        'security/delivery_carrier_security.xml',
        'views/product_template_view.xml',
        'views/delivery_view.xml',
        'views/partner_view.xml',
        'data/delivery_data.xml',
        'views/res_config_settings_views.xml',
        'wizard/choose_delivery_carrier_views.xml',
        'report/ir_actions_report_templates.xml',
    ],
    'demo': ['data/delivery_demo.xml'],
    'installable': True,
    'auto_install': True,
    'license': 'LGPL-3',
}
