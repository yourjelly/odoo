{
    'name': 'Scan Book QR Code',
    'version': '1.0',
    'description': """
This module enables the qrcode scanning feature for the vendor bills for india.
    """,
    'category': 'Accounting/Accounting',
    'depends': ['barcodes', 'product'],
    'sequence': 1,
    'assets': {
        'web.assets_backend': [
            'book_qr_code_scan/static/src/**/**/*',
        ],
    },
    'external_dependencies': {
        'python': ['pyjwt']
    },
    'installable': True,
    'license': 'OEEL-1',
}
