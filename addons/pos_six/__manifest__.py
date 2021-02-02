# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'POS Six',
    'version': '1.0',
    'category': 'Sales/Point Of Sale',
    'sequence': 6,
    'summary': 'Integrate your POS with a Six payment terminal',
    'description': '',
    'data': [
        'views/pos_payment_method_views.xml',
        
    ],
    'qweb': [
        'static/src/xml/BalanceButton.xml',
        'static/src/xml/Chrome.xml',
    ],
    'depends': ['point_of_sale'],
    'installable': True,
    'license': 'OEEL-1',
    'assets': {
        'assets': [
            # inside .
            'pos_six/static/lib/six_timapi/timapi.js',
            # inside .
            'pos_six/static/src/js/BalanceButton.js',
            # inside .
            'pos_six/static/src/js/Chrome.js',
            # inside .
            'pos_six/static/src/js/models.js',
            # inside .
            'pos_six/static/src/js/payment_six.js',
        ],
    }
}
