# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import json

from odoo import api, fields, models

URL = "https://etims-api-sbx.kra.go.ke/etims-api/"

class L10nKeEdiCustomsImport(models.Model):
    _name = 'l10n_ke_edi.customs.import'

    name = fields.Text('Information')
    product_id = fields.Many2one('product.product')
    company_id = fields.Many2one('res.company')
    confirmed = fields.Boolean()

    def action_send_match(self):
        session = self.company_id.l10n_ke_oscu_get_session()
        data = json.loads(self.name.replace("\'", "\"")) #TODO: avoid this hack anyways (maybe by putting normal fields instead)
        content = {
            'tin': self.company_id.vat,
            'bhfId': self.company_id.l10n_ke_oscu_branch_code,
            'cmcKey': self.company_id.l10n_ke_oscu_cmc_key,
            'taskCd': data['taskCd'],
            'dclDe': data['dclDe'],
            "itemSeq": data['itemSeq'],
            "hsCd": data['hsCd'] + '00',
            "itemClsCd": "30101500", #self.product_id.unspsc_code_id.code,
            "itemCd": self.product_id.l10n_ke_item_code,
            "imptItemSttsCd": "1", #What is this
            "remark": "",
            "modrNm": "Test",
            "modrId": "Test",
        }
        print(content)
        response = session.post(URL + 'updateImportItem', json=content)
        print(response.json())
