# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "Sale Matrix",
    'summary': "Add variants to Sales Order through a grid entry.",
    'description': """
        This module allows to fill Sales Order rapidly
        by choosing product variants quantity through a Grid Entry.
    """,
    'category': 'Sales/Sales',
    'version': '1.0',
    'depends': ['sale', 'product_matrix', 'sale_product_configurator'],
    'data': [
        
        'views/product_template_views.xml',
        'views/sale_views.xml',
        'report/sale_report_templates.xml',
    ],
    'demo': [
        'data/product_matrix_demo.xml'
    ]
    'assets': {
        'assets_backend_inherit_sale': [
            # after script[last()]
            'sale_product_matrix/static/src/js/product_matrix_configurator.js',
        ],
        'qunit_suite': [
            # inside .
            'sale_product_matrix/static/tests/section_and_note_widget_tests.js',
        ],
        'assets_tests': [
            # inside .
            'sale_product_matrix/static/tests/tours/sale_product_matrix_tour.js',
        ],
    }
}
