# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import collections

from odoo import api, models, _

class IrModelAccess(models.Model):
    _inherit = 'ir.model.access'

    def _is_loaded_after(self, rule):
        """Check if self is loaded after rule because of modules deps"""
        xml_ids = collections.defaultdict(list)
        domain = [('model', '=', 'ir.model.access'), ('res_id', 'in', (self + rule).ids)]
        for data in self.env['ir.model.data'].sudo().search_read(domain, ['module', 'res_id']):
            xml_ids[data['res_id']].append(data['module'])
        if self.id in xml_ids and rule.id in xml_ids:
            mod_1_name = xml_ids[self.id][0]
            mod_2_name = xml_ids[rule.id][0]
            if mod_1_name == mod_2_name:
                # Same module, loaded together.
                return True
            module_1 = self.env['ir.module.module'].search([('name', '=', mod_1_name)])
            module_2 = self.env['ir.module.module'].search([('name', '=', mod_2_name)])
            if module_2 in module_1.required_module_ids:
                return True
        return False