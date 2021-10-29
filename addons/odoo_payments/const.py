# Part of Odoo. See LICENSE file for full copyright and licensing details.

# Mapping of adyen.account.entity_type values to Adyen legal entity types
LEGAL_ENTITY_TYPE_MAPPING = {
    'business': 'Business',
    'individual': 'Individual',
    'nonprofit': 'NonProfit',
}

# TODO ANVFE is this still useful or do we only rely on internal's status?
# # Mapping of Adyen account holder statuses to adyen.account.account_status values
# ACCOUNT_STATUS_MAPPING = {
#     'Active': 'active',
#     'Inactive': 'inactive',
#     'Suspended': 'suspended',
#     'Closed': 'closed',
# }

# Mapping of Adyen verification statuses to adyen.kyc.status values
KYC_STATUS_MAPPING = {
    'INVALID_DATA': 'data_to_provide',
    'RETRY_LIMIT_REACHED': 'data_to_provide',
    'AWAITING_DATA': 'data_to_provide',
    'DATA_PROVIDED': 'data_provided',
    'PENDING': 'pending',
    'PASSED': 'passed',
    'FAILED': 'failed',
}

# Mapping of adyen.account.payout_schedule values to Adyen payout schedules
PAYOUT_SCHEDULE_MAPPING = {
    'daily': 'DAILY',
    'weekly': 'WEEKLY',
    'biweekly': 'BIWEEKLY_ON_1ST_AND_15TH_AT_MIDNIGHT',
    'monthly': 'MONTHLY',
}
