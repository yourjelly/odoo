# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import werkzeug

from odoo.addons.mail.controllers.main import MailController
from odoo import http

_logger = logging.getLogger(__name__)


class CrmController(http.Controller):

    @http.route('/lead/case_mark_won', type='http', auth='user', methods=['GET'])
    def crm_lead_case_mark_won(self, res_id, token):
        comparison, record, redirect = MailController._check_token_and_record_or_redirect('crm.lead', int(res_id), token)
        if comparison and record:
            try:
                record.action_set_won()
            except Exception:
                _logger.exception("Could not mark crm.lead as won")
                return MailController._redirect_to_messaging()
        return redirect

    @http.route('/lead/case_mark_lost', type='http', auth='user', methods=['GET'])
    def crm_lead_case_mark_lost(self, res_id, token):
        comparison, record, redirect = MailController._check_token_and_record_or_redirect('crm.lead', int(res_id), token)
        if comparison and record:
            try:
                record.action_set_lost()
            except Exception:
                _logger.exception("Could not mark crm.lead as lost")
                return MailController._redirect_to_messaging()
        return redirect

    @http.route('/lead/convert', type='http', auth='user', methods=['GET'])
    def crm_lead_convert(self, res_id, token):
        comparison, record, redirect = MailController._check_token_and_record_or_redirect('crm.lead', int(res_id), token)
        if comparison and record:
            try:
                record.convert_opportunity(record.partner_id.id)
            except Exception:
                _logger.exception("Could not convert crm.lead to opportunity")
                return MailController._redirect_to_messaging()
        return redirect

    @http.route('/lead/redirect_form_view', type='http', auth='user', methods=['GET'])
    def crm_lead_redirect_form_view(self, name):
        # http://localhost:8069/lead/redirect_form_view?name=bouhbouh
        server_action = http.request.env.ref("crm.superaction_youhou")
        return werkzeug.utils.redirect("web?&#action=%s&model=crm.lead&view_type=form&name=%s" % (server_action.id, name))
