# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Project with product',
    'version': '1.0',
    'category': 'Services/Project',
    'author': 'Odoo S.A',
    'sequence': 45,
    'summary': 'Connect products with project',

    'depends': [
        'project',
        'product',
        'stock',
        'purchase',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/project_task_views.xml',
        'views/project_product_views.xml',
    ],
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
