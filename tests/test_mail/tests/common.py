# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tools import mute_logger
from odoo.tools.translate import code_translations

from odoo.addons.mail.tests.common import MailCommon
from odoo.tests.common import TransactionCase


class TestMailCommon(MailCommon):
    @classmethod
    def _activate_multi_lang(cls, lang_code='es_ES', layout_arch_db=None, test_record=False, test_template=False):
        super()._activate_multi_lang(lang_code=lang_code, layout_arch_db=layout_arch_db, test_record=test_record, test_template=test_template)

        with mute_logger("odoo.addons.base.models.ir_module", "odoo.tools.translate"):
            cls.env.ref('base.module_test_mail')._update_translations([lang_code])
            code_translations.get_python_translations('test_mail', lang_code)

        code_translations.python_translations[('test_mail', 'es_ES')]['NotificationButtonTitle'] = 'SpanishButtonTitle'
        cls.addClassCleanup(code_translations.python_translations[('test_mail', 'es_ES')].pop, 'NotificationButtonTitle')


class TestRecipients(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super(TestRecipients, cls).setUpClass()
        Partner = cls.env['res.partner'].with_context({
            'mail_create_nolog': True,
            'mail_create_nosubscribe': True,
            'mail_notrack': True,
            'no_reset_password': True,
        })
        cls.partner_1 = Partner.create({
            'name': 'Valid Lelitre',
            'email': 'valid.lelitre@agrolait.com',
            'country_id': cls.env.ref('base.be').id,
            'mobile': '0456001122',
            'phone': False,
        })
        cls.partner_2 = Partner.create({
            'name': 'Valid Poilvache',
            'email': 'valid.other@gmail.com',
            'country_id': cls.env.ref('base.be').id,
            'mobile': '+32 456 22 11 00',
            'phone': False,
        })
