# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class IrHttp(models.AbstractModel):
    _inherit = 'ir.http'

    def session_info(self):
        res = super(IrHttp, self).session_info()
        if self.env.user.has_group('base.group_user'):
            res['gs1_separators_encodings'] = self.env['ir.config_parameter'].sudo().get_param('barcodes_gs1_nomenclature.gs1_separators_encodings', default=[('Alt', '0', '2', '9'), ('Ctrl', '[')])
        return res
