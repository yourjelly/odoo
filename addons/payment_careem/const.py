# The currencies supported by Careem Pay
SUPPORTED_CURRENCIES = ["AED", "SAR", "EGP", "PKR", "MAD", "JOD", "LBP", "USD", "EUR"]

# Mapping of transaction states to Careem Invoice objects statuses.
# For each object's exhaustive status list, see:
STATUS_MAPPING = {
    'draft': ('created',),
    'pending': ('in progress',),
    'authorized': ('requires_capture',),
    'done': ('paid',),
    'cancel': ('canceled',),
    'error': ('failed', 'failure'),
}
