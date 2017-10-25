# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import os

from odoo import api, fields, models


import logging; _logger = logging.getLogger(__name__)
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

    def _get_records_belonging_to_modules(self, module_names, model):
        external_ids = self.env['ir.model.data'].search([('module', 'in', module_names), ('model', '=', model)])
        return self.env[model].browse(external_ids.mapped('res_id'))

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

        # todo jov do this to do the uninstall hack. instead mark all 'themes' as uninstalled
        themes_installed_before = self.search([('name', '=like', 'theme_%'), ('state', '=', 'installed')])
        themes_installed_before.write({'state': 'uninstalled'})
        _logger.info('marked %s as uninstalled', themes_installed_before.mapped('name'))

        # mark all data belonging to theme as noupdate to prevent them from being unlinked after module installation finishes
        update_xml_ids = self.env['ir.model.data'].search([('module', 'in', themes_installed_before.mapped('name')), ('noupdate', '=', False)])
        update_xml_ids.write({'noupdate': True})

        # mark theme and button to be installed
        self.button_install()

        # although there is a 'themes' category
        # (base.module_category_theme) it seems not to be used for all
        # themes. The same is true for the
        # base.module_category_theme_hidden category, so just filter
        # on name instead.
        installed_theme_names = self.search([('state', '=', 'to install')]).filtered(lambda module: module.name.startswith('theme_')).mapped('name')
        _logger.info('installing themes %s', installed_theme_names)

        # newly_installed_themes = (self | self.dependencies_id.mapped('depend_id'))
        # if self.state == 'installed':
        #     newly_installed_themes.write({'state': 'uninstalled'})  # todo jov recursive dependencies

        next_action = self._apply_changes()  # Then install the new chosen one
        if next_action.get('tag') == 'reload' and not next_action.get('params', {}).get('menu_id'):
            next_action = self.env.ref('website.action_website').read()[0]

        for view in self._get_records_belonging_to_modules(installed_theme_names, 'ir.ui.view'):
            if not view.website_id:
                view.website_id = install_on_website

        # can't write in one 'write' because of ensure_one in write of website.page
        for page in self._get_records_belonging_to_modules(installed_theme_names, 'website.page'):
            if not page.website_id:
                page.website_id = install_on_website

        for menu in self._get_records_belonging_to_modules(installed_theme_names, 'website.menu'):
            if not menu.website_id:
                menu.website_id = install_on_website

        # make xml id unique so the same theme can be installed on multiple websites
        for external_id in self.env['ir.model.data'].search([('module', 'in', installed_theme_names), ('model', '!=', 'ir.attachment')]):
            if '_website_' not in external_id.name:
                external_id.name += '_website_%s' % install_on_website.id

        self.installed_on_website_ids |= install_on_website

        update_xml_ids.write({'noupdate': False})
        themes_installed_before.write({'state': 'installed'})
        _logger.info('marked %s as installed again', themes_installed_before.mapped('name'))

        return next_action

    # todo jov unset website.theme_id on uninstall
