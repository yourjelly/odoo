# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.mail.controllers.discuss import DiscussController

from odoo import http
from odoo.http import request
from odoo.exceptions import AccessError


class DiscussControllerExpense(DiscussController):
    @http.route('/mail/thread/data', methods=['POST'], type='json', auth='user')
    def mail_thread_data(self, thread_model, thread_id, request_list, **kwargs):
        res = super().mail_thread_data(thread_model, thread_id, request_list, **kwargs)
        if thread_model == 'hr.expense.sheet':
            thread = request.env[thread_model].with_context(active_test=False).search([('id', '=', thread_id)])
            try:
                thread.check_access_rights("write")
                thread.check_access_rule("write")
                res['hasWriteAccess'] = True
            except AccessError:
                pass
            if 'attachments' in request_list:
                expense_ids = thread.env['hr.expense.sheet'].browse(thread.id).expense_line_ids
                expense_attachments = thread.env['ir.attachment'].search([('res_id', 'in', expense_ids.ids), ('res_model', '=', 'hr.expense')], order='id desc')._attachment_format(commands=True)
                res['attachments'].extend(expense_attachments)
        return res
