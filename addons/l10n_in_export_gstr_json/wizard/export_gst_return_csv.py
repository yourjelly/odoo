# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo import SUPERUSER_ID


class ExportGstReturn(models.TransientModel):
    _inherit = "export.gst.return"

    file_type = fields.Selection([('csv', 'CSV'), ('json', 'JSON')], string="File Type", default='csv', required=True)
    gross_turnover = fields.Float("Gross Turnover in the preceding Financial Year", required=True)
    cur_gross_turnover = fields.Float("Gross Turnover in the current Financial Year", required=True)

    @api.multi
    def export_gstr_json(self):
        self.ensure_one()
        if self.gst_return_type == 'gstr1':
            template = self.env.ref('l10n_in_export_gstr.view_company_form_inherit_export_gstr', False)
            if (self.env.uid == SUPERUSER_ID and template) and not (self.env.user.company_id.state_id or self.env.user.company_id.vat):
                return {
                    'name': _('Choose Your State'),
                    'type': 'ir.actions.act_window',
                    'view_type': 'form',
                    'view_mode': 'form',
                    'res_id': self.env.user.company_id.id,
                    'res_model': 'res.company',
                    'views': [(template.id, 'form')],
                    'view_id': template.id,
                    'target': 'new',
                }
            return {
                'type': 'ir.actions.act_url',
                'url': '/json/download/%s' % (self.id)
            }
