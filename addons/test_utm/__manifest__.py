# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'UTM Tests',
    'version': '1.0',
    'category': 'Hidden',
    'sequence': 9879,
    'summary': 'UTM Tests: tests specific to the UTM module',
    'description': """This module contains tests related to UTMs. Those are
present in a separate module as it contains models used only to perform
tests independently to functional aspects of other models. """,
    'depends': [
        'utm',
    ],
    'data': [
        'security/ir.model.access.csv',
    ],
    'installable': True,
    'license': 'LGPL-3',
}
