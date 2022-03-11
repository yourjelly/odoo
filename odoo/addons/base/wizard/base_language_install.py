# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class BaseLanguageInstall(models.TransientModel):
    _name = "base.language.install"
    _description = "Install Language"

    @api.model
    def _default_language(self):
        """ Display the selected language when using the 'Update Terms' action
            from the language list view
        """
        if self._context.get('active_model') == 'res.lang':
            lang = self.env['res.lang'].browse(self._context.get('active_id'))
            return lang.code
        return False


    @api.model
    def _get_languages(self):
        return [[code, name] for code, _, name, *_ in self.env['res.lang'].get_available()]

    def _get_info_message(self):
        for wizard in self:
            if not wizard.lang:
                wizard.info_message = False
                continue
            lang, country = wizard.lang.split("_")
            if lang == country.lower():
                # e.g. fr_FR
                wizard.info_message = False
                continue
            base_lang = f"{lang}_{lang.upper()}"
            languages = dict(self._get_languages())
            if base_lang in languages.keys():
                wizard.info_message = _("This translation is based on %r content and may lack of regional language variations.",
                    languages[base_lang])
            else:
                wizard.info_message = False

    lang = fields.Selection(_get_languages, string='Language', required=True,
                            default=_default_language)
    overwrite = fields.Boolean('Overwrite Existing Terms',
                               default=True,
                               help="If you check this box, your customized translations will be overwritten and replaced by the official ones.")
    state = fields.Selection([('init', 'init'), ('done', 'done')],
                             string='Status', readonly=True, default='init')
    info_message = fields.Char(compute=_get_info_message, string="Info Message")

    def lang_install(self):
        self.ensure_one()
        mods = self.env['ir.module.module'].search([('state', '=', 'installed')])
        self.env['res.lang']._activate_lang(self.lang)
        mods._update_translations(self.lang, self.overwrite)
        self.state = 'done'
        self.env.cr.execute('ANALYZE ir_translation')

        return {
            'name': _('Language Pack'),
            'view_mode': 'form',
            'view_id': False,
            'res_model': 'base.language.install',
            'domain': [],
            'context': dict(self._context, active_ids=self.ids),
            'type': 'ir.actions.act_window',
            'target': 'new',
            'res_id': self.id,
        }

    def reload(self):
        return {
            'type': 'ir.actions.client',
            'tag': 'reload',
        }

    def switch_lang(self):
        self.env.user.lang = self.lang
        return {
            'type': 'ir.actions.client',
            'tag': 'reload_context',
        }
