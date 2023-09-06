# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "Sales PDF Quotation Builder",
    'category': 'Sales/Sales',
    'description': "Build nice quotations",
    'depends': ['sale_management'],
    'data': [
        'views/sale_order_template_views.xml',
        'views/res_config_settings_views.xml',
    ],
    'demo': [
        'data/sale_pdf_quote_builder_data.xml',
    ],
    'installable': True,
    'license': 'LGPL-3',
}
