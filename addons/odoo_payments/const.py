# Part of Odoo. See LICENSE file for full copyright and licensing details.

# Mapping of Adyen account holder statuses to adyen.account.account_status values
ACCOUNT_STATUS_MAPPING = {
    'Active': 'active',
    'Inactive': 'inactive',
    'Suspended': 'suspended',
    'Closed': 'closed',
}

# Mapping of Adyen verification statuses to adyen.kyc.status values
KYC_STATUS_MAPPING = {
    'INVALID_DATA': 'awaiting_data',
    'RETRY_LIMIT_REACHED': 'awaiting_data',
    'AWAITING_DATA': 'awaiting_data',
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
