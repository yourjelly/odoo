# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'Hr Holidays Contract',
    'version': '1.0',
    'category': 'Human Resources/Time off',
    'summary': 'Bridge module between Time off and contract',
    'description': """
        Bridge module allow to manage Time off based on contract.
    """,
    'depends': ['hr_holidays', 'hr_contract'],
    'installable': True,
    'auto_install': True,
    'license': 'LGPL-3',
}
