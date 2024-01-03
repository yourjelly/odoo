# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging

from odoo import api, fields, models

URL = "https://etims-api-sbx.kra.go.ke/etims-api/"
CODE_SEARCH_URL = URL + "selectCodeList"

_logger = logging.getLogger(__name__)

CODE_TYPES = [
    # Commented codes are listed for completeness, but are currently either
    # unused, or implemented as selection fields in our system.
    ('04', 'Taxation Type'),
    ('05', 'Country'),
    ('07', 'Payment Type'),
    ('09', 'Branch Status'),
    ('10', 'Quantity Unit'),
    ('11', 'Sale Status'),
    ('12', 'Stock I/O Type'),
    ('14', 'Transaction Type'),
    ('17', 'Packing Unit'),
    ('24', 'Item Type'),
    ('26', 'Import Item Status'),
    ('32', 'Refund Reason'),
    ('33', 'Currency'),
    ('34', 'Purchase Status'),
    ('35', 'Reason of Inventory Adjustment'),
    ('36', 'Bank'),
    ('37', 'Sales Receipt Type'),
    ('38', 'Purchase Receipt Type'),
    ('45', 'Tax Office'),
    ('48', 'Locale'),
    ('49', 'Category Level'),
]

class L10nKeOSCUCode(models.Model):
    _name = 'l10n_ke_edi_oscu.code'

    code_type = fields.Selection(selection=CODE_TYPES)
    code = fields.Char()
    name = fields.Char()
    description = fields.Char()
    active = fields.Boolean(default=True)
    order = fields.Integer()

    tax_rate = fields.Float()

    def _create_vals_from_json(self, json_content):
        """ Create codes from the standard json output

        :param dict json_content: the "data" from the selectCodeList query to the device.
        :returns: a list of dicts, can be used to create a recordset of the codes from the parsed data.
        """
        codes_to_create = []
        code_type_specific_fields = {
            # i.e. When cdCls is '04', update the value of the field 'tax_rate' with the value of 'userDfnCd1' cast as a float
            '04': [('tax_rate', float)],
        }
        code_types_in_use = [num for num, _desc in self._fields['code_type'].selection]
        print(json_content)
        for code_data in json_content['clsList']:
            code_type = code_data['cdCls']
            if code_type not in code_types_in_use:
                continue
            code_list = code_data['dtlList']
            codes_to_create += [{
                'code_type': code_type,
                'code': code['cd'],
                'name': code['cdNm'],
                'description': code['cdDesc'],
                'active': True if code['useYn'] == 'Y' else False,
                'order': int(code['srtOrd']),
                **{
                    name: transform(code[correlate]) for
                    (name, transform), correlate in
                    zip(
                        code_type_specific_fields.get(code_type, []),
                        ['userDfnCd1', 'userDfnCd2', 'userDfnCd3']
                    )
                }
            } for code in code_list]

        return codes_to_create

    def _create_or_update_from_vals(self, create_vals):
        """ Update existing records, or create new ones depending on whether the code exists

        :param list[dict] create_vals: list of l10n_ke_edi_oscu.code creation vals.
        :returns: tuple consisting of a recordset of created codes and a recordset of updated codes.
        """
        self.env.cr.execute("""
            SELECT code_type, ARRAY_AGG(code), ARRAY_AGG(id) FROM l10n_ke_edi_oscu_code
            GROUP BY code_type
            ORDER BY code_type
        """)
        existing_code_details = {code_type: (codes, code_ids) for code_type, codes, code_ids in self.env.cr.fetchall()}
        to_create = []
        updated_codes = self

        for val in create_vals:
            if val['code_type'] in existing_code_details:
                codes, code_ids = existing_code_details[val['code_type']]
                if val['code'] in codes:
                    to_update = self.browse(code_ids[codes.index(val['code'])])
                    to_update.write(val)
                    updated_codes |= to_update
                    continue
            to_create.append(val)
        return self.create(to_create), updated_codes

    def _cron_get_codes_from_device(self):
        """ Automatically fetch, and create or update codes from the KRA, using the endpoint on the device """
        company = self.env['res.company'].search([
            ('l10n_ke_oscu_cmc_key', '!=', False),
        ], limit=1)
        if not company:
            _logger.error('No OSCU initialized company could be found. No KRA Codes fetched.')
            return

        session = company.l10n_ke_oscu_get_session()
        # The API will return all codes added since this date
        last_request_date = self.env['ir.config_parameter'].get_param('l10n_ke_oscu.last_code_request_date', '20180101000000')
        response = session.post(CODE_SEARCH_URL, json={'lastReqDt': last_request_date})
        print(response.content)
        if (response_content := response.ok and response.json()):
            if response_content['resultCd'] == '001':
                _logger.info("No new KRA standard codes fetched from the OSCU.")
                return
            if response_content['resultCd'] == '000':
                created, updated = self.sudo()._create_or_update_from_vals(self._create_vals_from_json(response_content['data']))
                _logger.info("Fetched KRA standard codes from the OSCU, created %i and updated %i.", len(created), len(updated))
                self.env['ir.config_parameter'].sudo().set_param('l10n_ke_oscu.last_code_request_date', fields.Datetime.now().strftime('%Y%m%d%H%M%S'))
                return

            _logger.error('Request Error Code: %s, Message: %s', response_content['resultCd'], response_content['resultMsg'])
