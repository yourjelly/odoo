# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ExportGstReturnCsv(models.TransientModel):
    _name = "export.gst.return.csv"
    _description = 'Export GSTR'

    def _default_get_month(self):
        return fields.Date.from_string(fields.Date.context_today(self)).strftime('%m')

    def _default_get_year(self):
        return fields.Date.from_string(fields.Date.context_today(self)).strftime('%Y')

    @api.model
    def _get_year(self):
        current_year = fields.Date.from_string(fields.Date.context_today(self)).year
        return [('%s'%(current_year+year_count), '%s'%(current_year+year_count)) for year_count in range(-1, 2)]

    def _default_get_export_summary(self):
        return 'b2b'

    @api.model
    def _get_export_summary_type(self):
        if self.env.context.get('default_gst_return_type') == 'gstr2':
            return [('b2b', 'B2B Supplies received'),
               ('b2bur', 'Inward supplies from unregistered Supplier'),
               ('imps', 'Import of Services'),
               ('impg', 'Import of Goods'),
               ('cdnr', 'Credit/ Debit Note'),
               ('cdnur', 'Credit/ Debit Note for unregistered Persons'),
               ('at', 'Tax liability on advances'),
               ('atadj', 'Advance adjustments'),
               ('exempt', 'Nil Rated, Exempted and Non GST supplies'),
               #('itcr', 'Input tax Credit Reversal/Reclaim'),
               ('hsnsum', 'HSN Summary')
               ]
        return [('b2b', 'B2B Supplies'),
               ('b2cl', 'B2C Large'),
               ('b2cs', 'B2C Small'),
               ('cdnr', 'Credit/Debit Note'),
               ('cdnur', 'Credit/Debit Note for unregistered Person'),
               ('exp', 'Export'),
               ('at', 'Tax Liability on advances'),
               ('atadj', 'Advance adjustments'),
               ('exemp', 'Nil Rated, Exempted and Non GST supplies'),
               ('hsn', 'HSN Summary'),
               ('docs', 'List of Documents issued')
               ]
    gst_return_type = fields.Selection([('gstr1', 'GSTR-1'), ('gstr2','GSTR-2')], string='GST return type', required=True, default='gstr1')
    month = fields.Selection([('01', 'January'), ('02', 'February'), ('03', 'March'),
                               ('04', 'April'), ('05', 'May'), ('06', 'June'), ('07', 'July'),
                               ('08', 'August'), ('09', 'September'), ('10', 'October'),
                               ('11', 'November'), ('12', 'December')], string='Tax Month', required=True, default=_default_get_month)
    year = fields.Selection('_get_year', string="Financial Year", required=True, default=_default_get_year)

    #gst_return_section_id = fields.Many2one('gst.return.section', string='Section', required=True)
    export_summary = fields.Selection('_get_export_summary_type', string="Export Summary For", default=_default_get_export_summary)

    @api.onchange('gst_return_type')
    def onchange_gst_return_type(self):
        self.gst_return_section_id = False

    @api.multi
    def export_gstr(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'url': '/csv/download/%s' % (self.id)
        }
