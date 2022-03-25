{
    'name': 'Coconuts Theme',
    'summary': '',
    'description': '',
    'category': 'Theme/Demo',
    'version': '15.0.0',
    'depends': ['website'],
    'license': 'OEEL-1',
    'data': [
        # Menu
        'data/menu.xml',
        # Images
        # 'data/images.xml',
        # Pages
        # 'data/pages/about_us.xml',
        # 'data/pages/home.xml',
        # Frontend
        'views/header.xml',
        'views/footer.xml',
        'views/copyright.xml',
    ],
    'assets': {
        'web._assets_primary_variables': [
            'theme_coconuts/static/src/scss/primary_variables.scss',
        ],
        'web._assets_frontend_helpers': [
            ('prepend', 'theme_coconuts/static/src/scss/bootstrap_overridden.scss'),
        ],
        'web.assets_frontend': [
            # JS
            'theme_coconuts/static/src/js/theme.js',
            # SCSS
            'theme_coconuts/static/src/scss/theme.scss',
        ],
    },
}
