{
    'name': 'Time series Forecast',
    'depends': [
        'base',
    ],
    'data': [
        'security/ir.model.access.csv',
    ],
    'assets': {
        'web.assets_backend': [
            'ts_forecast/static/src/**/*',
            ]
    },
    'application': True,
}