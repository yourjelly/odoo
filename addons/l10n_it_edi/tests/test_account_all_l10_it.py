# -*- coding: utf-8 -*-
from odoo.addons.account.tests.test_account_all_l10n import TestAllL10n

def l10n_it_extra_val_company(self, vals):
    vals.update({
        'vat': 'IT12345670017',
        'l10n_it_codice_fiscale': 'IT12345670018',
        'l10n_it_tax_system': 'RF01',
        'street2': "test",
        'zip': '43444',
        'city': "test",
    });

def l10n_it_extra_val_partner(self, vals):
    vals.update({
        'street2': "test",
        'zip': "43444",
        'city': "test",
        'vat': "IT12345670017",
    });

TestAllL10n.l10n_it_extra_val_company = l10n_it_extra_val_company
TestAllL10n.l10n_it_extra_val_partner = l10n_it_extra_val_partner