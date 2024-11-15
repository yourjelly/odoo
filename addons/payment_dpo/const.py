# Part of Odoo. See LICENSE file for full copyright and licensing details.

# The codes of the payment methods to activate when DPO is activated.
DEFAULT_PAYMENT_METHOD_CODES = {
    # Primary payment methods.
    'card',
}

# TODO-DPO Complete with PAYMENT_METHODS_MAPPING,
# REDIRECT_PAYMENT_METHODS
# Adapt DEFAULT_PAYMENT_METHOD_CODES

PAYMENT_STATUS_MAPPING = {
    'pending': ('003', '007'),
    'authorized': ('001', '005'),
    'done': ('000', '002'), # TODO-DPO verify the codes 002: Transaction overpaid/underpaid
    'cancel': ('900', '901', '902', '903', '904', '950'),
    'error': ('801', '802', '803', '804'),
}

# TODO-DPO complete
# Mapping of payment method codes to DPO codes.
# PAYMENT_METHODS_MAPPING = {
#     'card': '',
#     'bank_transfer': '',
# }