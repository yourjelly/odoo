"""
Tax map for non EU countries that want to use the OSS system.
it takes the form tuple: rate, where
    (Fiscal Country Code, Domestic Tax Rate, Foreign Country Code): Foreign Tax Rate
"""

EXTRA_EU_TAG_MAP = {
    # United Kingdom
    'l10n_uk.l10n_uk': {
        'invoice_base_tag': None,
        'invoice_tax_tag': None,
        'refund_base_tag': None,
        'refund_tax_tag': None,
    },
}
