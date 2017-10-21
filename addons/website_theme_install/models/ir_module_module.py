# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import os

from odoo import api, fields, models


class IrModuleModule(models.Model):
    _name = "ir.module.module"
    _inherit = _name

    image_ids = fields.One2many('ir.attachment', 'res_id',
                                domain=[('res_model', '=', _name), ('mimetype', '=like', 'image/%')],
                                string='Screenshots', readonly=True)
    installed_on_website_ids = fields.One2many('website', 'theme_id')
    is_theme_installed_on_this_website = fields.Boolean(compute='_compute_is_theme_installed_on_this_website')

    @api.multi
    def _compute_is_theme_installed_on_this_website(self):
        current_website = self.env['website'].get_current_website()
        for module in self:
            module.is_theme_installed_on_this_website = current_website in module.installed_on_website_ids

    @api.model
    def update_list(self):
        res = super(IrModuleModule, self).update_list()

        IrAttachment = self.env['ir.attachment']
        existing_urls = IrAttachment.search_read([['res_model', '=', self._name], ['type', '=', 'url']], ['url'])
        existing_urls = [url_wrapped['url'] for url_wrapped in existing_urls]

        for app in self.search([]):
            terp = self.get_module_info(app.name)
            images = terp.get('images', [])
            for image in images:
                image_path = os.path.join(app.name, image)
                if image_path not in existing_urls:
                    image_name = os.path.basename(image_path)
                    IrAttachment.create({
                        'type': 'url',
                        'name': image_name,
                        'datas_fname': image_name,
                        'url': image_path,
                        'res_model': self._name,
                        'res_id': app.id,
                    })

        return res

    @api.multi
    def button_choose_theme(self):
        install_on_website = self.env['website'].get_current_website()

        theme_category = self.env.ref('base.module_category_theme', False)
        hidden_category = self.env.ref('base.module_category_hidden', False)
        theme_hidden_category = self.env.ref('base.module_category_theme_hidden', False)

        theme_category_id = theme_category.id if theme_category else 0
        hidden_categories_ids = [hidden_category.id if hidden_category else 0, theme_hidden_category.id if theme_hidden_category else 0]

        # todo jov fix auto-uninstall
        # self.search([  # Uninstall the theme(s) which is (are) installed
        #     ('state', '=', 'installed'),
        #     # ('website_id', '=', install_on_website.id),  todo jov
        #     '|', ('category_id', 'not in', hidden_categories_ids), ('name', '=', 'theme_default'),
        #     '|', ('category_id', '=', theme_category_id), ('category_id.parent_id', '=', theme_category_id),
        # ]).button_immediate_uninstall()

        # todo jov: to support installing the same theme twice on different websites:
        # 1. mark installed theme + dependencies as uninstalled
        # 2. continue as normal
        # module will be automatically marked back as being installed and xmlids shouldn't conflict because of hack
        if self.state == 'installed':
            (self | self.dependencies_id).write({'state': 'uninstalled'})  # todo jov recursive dependencies, maybe also filter themes

        next_action = self.button_immediate_install()  # Then install the new chosen one
        if next_action.get('tag') == 'reload' and not next_action.get('params', {}).get('menu_id'):
            next_action = self.env.ref('website.action_website').read()[0]

        # todo jov: themes can have dependencies, e.g. theme_loftspace and theme_loftspace_sale
        view_external_ids = self.env['ir.model.data'].search([('module', '=', self.name), ('model', '=', 'ir.ui.view')])
        self.env['ir.ui.view'].browse(view_external_ids.mapped('res_id')).write({
            'website_id': install_on_website.id,
        })

        # make xml id unique so the same theme can be installed on multiple websites
        for external_id in view_external_ids:
            external_id.name += '_%s' % install_on_website.id

        self.installed_on_website_ids |= install_on_website

        return next_action
