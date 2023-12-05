# Part of Odoo. See LICENSE file for full copyright and licensing details.


SUPPORTED_CURRENCIES = (
    'INR',
    'USD',
)

API_URLS = {
    'production': 'https://api.phonepe.com/apis/hermes',
    'test': 'https://api-preprod.phonepe.com/apis/pg-sandbox',
}

DEFAULT_PAYMENT_METHODS_CODES = [
    'card',
    'netbanking',
    'upi',
]

END_POINT = '/pg/v1/pay'
SSTRING = '###'
