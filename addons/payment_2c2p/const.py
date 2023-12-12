# Part of Odoo. See LICENSE file for full copyright and licensing details.

# Currencies supported by 2C2P
# https://developer.2c2p.com/docs/reference-codes-currency
SUPPORTED_CURRENCIES = [
    'THB',
    'SGD',
    'MYR',
    'USD',
    'IDR',
    'TWD',
    'HKD',
    'PHP',
    'MMK',
    'EUR',
    'JPY',
    'AUD',
    'BDT',
    'CAD',
    'CHF',
    'CNY',
    'DKK', 
    'GBP', 
    'HTG', 
    'KHR', 
    'KRW', 
    'LAK', 
    'NOK', 
    'NZD', 
    'RUB', 
    'SEK', 
    'VND', 
    'YER',
]

API_URLS = {
    'production': {
        'paymentToken': 'https://pgw.2c2p.com/payment/4.3/paymentToken',
    },
    'test': {
        'paymentToken': 'https://sandbox-pgw.2c2p.com/payment/4.3/paymentToken',
    },
}

# See: https://developer.2c2p.com/docs/response-code-payment
STATUS_MAPPING = {
    'pending': ('1003', '0001', '2001'),
    'done': ('2000', '0000'),
    'cancel': ('0003', '4081'),
    'error': ('0999',),
}

PAYMENT_METHODS_MAPPING = {
    'card': 'CC',
    'web_pay': '123',
    'alipay': 'ALIPAY',
    'paypal': 'PAYPAL',
    'shopeepay': 'SHPPAY',
    'grabpay': 'GRAB',
    'linepay': 'LINE',
    'truemoney': 'TRUEMONEY',
    'touch_n_go': 'TNG',
    'boost': 'BOOST',
    'maya': 'PAYMAYA',
    'gcash': 'GCASH',
    'ovo': 'OVO',
    'linkaja': 'LINKAJA',
    'dana': 'DANA',
    'gopay': 'GOPAY',
    'jeniuspay': 'JENIUS',
    'paytm': 'CAPT',
    'alipay_hk': 'ALIPAYHK',
    'octopus': 'OCTPAY',
    'payme': 'PAYME',
    'momo': 'MOMO',
    'zalopay': 'ZALOPAY',
    'kakaopay': 'KAKAO',
    'jkopay': 'JKOPAY',
    'atome': 'ATOME',
    'hoolah': 'HOOLAH',
    'billease': 'BILLEASE',
    'humm': 'HUMM',
    'tendopay': 'TENDOPAY',
}

DEFAULT_PAYMENT_METHODS_CODES = [
    # Primary payment methods.
    'card',
    # Brand payment methods.
    'visa',
    'mastercard',
    'jcb',
    'amex',
    'diners',
    'discover',
    'rupay',
]
