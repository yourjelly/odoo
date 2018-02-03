{
    'name': 'JS Demo',
    'version': '1.0',
    'author': ['Odoo SA (ged)'],
    'maintainer': 'Odoo SA',
    'category': 'Extra Tools',
    'description': """
Field Widget Demo
===================

This addon is just a short demo on how to add/modify field widgets
in any form (and list/kanban) view.

Note that in a real situation, if such a customization is done by
another entity (not Odoo), then this addon should not be located in
the odoo addons/ folder, but rather in a separate folder maintained
by the other entity.  In that case, the server needs to be started
with the command --addons-path to be sure it can find the proper
directory.
""",
    'depends': ['web'],
    'data': [
        'views/assets.xml',
    ],
}
