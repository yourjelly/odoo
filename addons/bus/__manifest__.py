{
    'name' : 'IM Bus',
    'version': '1.0',
    'category': 'Hidden',
    'complexity': 'easy',
    'description': "Instant Messaging Bus allow you to send messages to users, in live.",
    'depends': ['base', 'web'],
    'data': [
        
        'security/ir.model.access.csv',
    ],
    'installable': True,
    'assets': {
        'assets_backend': [
            # inside .
            'bus/static/src/js/longpolling_bus.js',
            # inside .
            'bus/static/src/js/crosstab_bus.js',
            # inside .
            'bus/static/src/js/services/bus_service.js',
            # inside .
            'bus/static/src/js/web_client_bus.js',
        ],
        'assets_frontend': [
            # inside .
            'bus/static/src/js/longpolling_bus.js',
            # inside .
            'bus/static/src/js/crosstab_bus.js',
            # inside .
            'bus/static/src/js/services/bus_service.js',
        ],
        'qunit_suite': [
            # after //script[last()]
            'bus/static/tests/bus_tests.js',
        ],
        'assets_tests': [
            # inside .
            'bus/static/tests/bus_tests_tour.js',
        ],
    }
}
