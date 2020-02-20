# -*- coding: utf-8 -*-
from odoo.addons.account.tests.test_account_all_l10n import TestAllL10n

def l10n_ar_extra_val_partner(self, vals):
    vals.update({
        'l10n_ar_afip_responsibility_type_id': self.env.ref('l10n_ar.res_IVA_LIB').id,
    });

TestAllL10n.l10n_ar_extra_val_partner = l10n_ar_extra_val_partner