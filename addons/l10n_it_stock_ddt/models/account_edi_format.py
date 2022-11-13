# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, models



class AccountEdiFormat(models.Model):
    _inherit = 'account.edi.format'


    def _l10n_it_document_type_mapping(self):
        res = super()._l10n_it_document_type_mapping()
        res.update({
            'TD24': dict(move_types=['out_invoice'], import_type='in_invoice', ddt_deferred=True)
        })
        return res

    def _l10n_it_compare_codes_list(self, invoice, infos):
        ddt_deferred = False
        if invoice.l10n_it_ddt_ids:
            import pdb; pdb.set_trace()
            if invoice.invoice_date > invoice.l10n_it_ddt_ids.mapped('date_done')[0]: #TODO: put like a day later
                ddt_deferred = True
        res = super()._l10n_it_compare_codes_list(invoice, infos)
        res.append(ddt_deferred == infos.get('ddt_deferred', False))
        return res