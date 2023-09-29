# Part of Odoo. See LICENSE file for full copyright and licensing details.

# ISO 4217 codes of currencies supported by HDFC
# Last seen on: 22 September 2022.

SUPPORTED_CURRENCIES = (
    'INR',
    'USD',
    'SGD',
    'EUR',
)

MAPPING_PAYMENT_METHODS = {
    'ivrs': 'net_banking',
    'net banking': 'net_banking',
    'credit card': 'card',
    'debit card': 'card',
    'cash card': 'card',
    'upi': 'upi',
    'emi': 'emi',
    'wallet': 'wallets_india'
}

API_URLS = {
    'production': "https://secure.ccavenue.com/transaction/transaction.do",
    'test': "https://test.ccavenue.com/transaction/transaction.do",
}
