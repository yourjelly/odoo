# Part of Odoo. See LICENSE file for full copyright and licensing details.

# The currencies supported by Razorpay, in ISO 4217 format. Last updated on May 26, 2021.
# See https://razorpay.com/docs/payments/payments/international-payments/#supported-currencies.
# Last seen online: 16 November 2022.
SUPPORTED_CURRENCIES = [
    'INR',
    'USD',
]

# The codes of the payment methods to activate when phonepe is activated.
DEFAULT_PAYMENT_METHODS_CODES = [
    # Primary payment methods.
    'card',
    'netbanking',
    'upi',
]

PAYMENT_STATUS_MAPPING = {
    'pending': ('INTERNAL_SERVER_ERROR', 'PAYMENT_PENDING',),
    'done': ('PAYMENT_SUCCESS',),
    'error': ('BAD_REQUEST','AUTHORIZATION_FAILED', 'PAYMENT_ERROR', 'TRANSACTION_NOT_FOUND', 'PAYMENT_DECLINED', 'TIMED_OUT'),
}