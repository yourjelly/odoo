# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging

from odoo import api, fields, models

URL = "https://etims-api-sbx.kra.go.ke/etims-api/"
NOTICE_SEARCH_URL = URL + "selectNoticeList"

_logger = logging.getLogger(__name__)


class L10nKeOSCUNotice(models.Model):
    _name = 'l10n_ke_edi_oscu.notice'

    number = fields.Integer()
    title = fields.Char()
    contents = fields.Char()
    detail_url = fields.Char()

    def _create_vals_from_json(self, notice_json):
        """ Create notice from the standard json output

        :param dict notice_json: individual representation of the notice from the "noticeList" as
                                 returned by the query to the device.
        :returns:                a dict, can be used to create a notice record from the parsed data.
        """
        return {
        }

    def _cron_l10n_ke_oscu_get_notices(self):
        """  """
        company = self.env['res.company'].search([
            ('l10n_ke_oscu_cmc_key', '!=', False),
        ], limit=1)
        if not company:
            _logger.error('No OSCU initialized company could be found. No KRA notices fetched.')
            return

        session = company.l10n_ke_oscu_get_session()
        # The API will return all codes added since this date
        last_request_date = self.env['ir.config_parameter'].get_param('l10n_ke_oscu.last_notice_request_date', '20180101000000')
        response = session.post(NOTICE_SEARCH_URL, json={'lastReqDt': last_request_date})
        if (response_content := response.ok and response.json()):
            if response_content['resultCd'] == '001':
                _logger.info("No new KRA notices fetched from the OSCU.")
                return
            if response_content['resultCd'] == '000':
                notice_list = response_content['data']['noticeList']
                existing_notice_numbers = self.search([
                    ('number', 'in', [notice['noticeNo'] for notice in notice_list]),
                ]).mapped("number")
                import pudb; pudb.set_trace()
                new_notices = self.create([{
                    'number':     notice['noticeNo'],
                    'title':      notice['title'],
                    'contents':   notice['cont'],
                    'detail_url': notice['dtlUrl'],
                } for notice in notice_list if notice['noticeNo'] not in existing_notice_numbers])
                _logger.info("%i UNSPSC codes fetched from the OSCU, %i UNSPSC codes created", len(notice_list), len(new_notices))
                return
            _logger.error('Request Error Code: %s, Message: %s', response_content['resultCd'], response_content['resultMsg'])
