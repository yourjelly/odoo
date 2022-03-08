{
    'name': 'Test Module',
    'summary': '',
    'description': '',
    'category': 'Website/Theme',
    'version': '14.0.0',
    'author': 'Odoo S.A.',
    'depends': ['website'],
    'data': [
        # Shapes
        'data/shapes.xml',
        'views/snippets/options.xml',
        # Pages
        'data/pages/home.xml',
    ],
    'assets': {
        'web._assets_primary_variables': [
            'website_module/static/src/scss/primary_variables.scss',
        ],
        'web._assets_frontend_helpers': [
            ('prepend', 'website_module/static/src/scss/bootstrap_overridden.scss'),
        ],
    },
}
