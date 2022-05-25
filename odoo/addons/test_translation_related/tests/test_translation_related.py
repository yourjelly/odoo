# -*- coding: utf-8 -*-
import io

import odoo.tests
from odoo.tools import trans_load_data


@odoo.tests.tagged('post_install', '-at_install')
class TestTranslationRelated(odoo.tests.TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env['res.lang']._activate_lang('fr_FR')
        cls.test1 = cls.env['test.model.1'].with_context(lang='en_US').create({
            'name': 'Knife',
            'html': '<p>Knife</p><p>Fork</p><p>Spoon</p>',
        })
        cls.test1.with_context(lang='fr_FR').write({
            'name': 'Couteau',
        })
        cls.test1.env['ir.translation'].create([{
            'type': 'model_terms',
            'name': 'test.model.1,html',
            'lang': 'fr_FR',
            'res_id': cls.test1.id,
            'src': src,
            'value': value,
            'state': 'translated',
        } for src, value in [('Knife', 'Couteau'), ('Fork', 'Fourchette'), ('Spoon', 'Cuiller')]])
        cls.test2 = cls.env['test.model.2'].with_context(lang='en_US').create({
            'parent_id': cls.test1.id,
        })

    def test_read(self):
        self.assertEqual(self.test1.with_context(lang='en_US').name, 'Knife')
        self.assertEqual(self.test1.with_context(lang='fr_FR').name, 'Couteau')
        self.assertEqual(self.test2.with_context(lang='en_US').name, 'Knife')
        self.assertEqual(self.test2.with_context(lang='fr_FR').name, 'Couteau')

    def test_write_from_ori(self):
        self.test1.with_context(lang='en_US').name = 'New knife'
        self.assertEqual(self.test1.with_context(lang='en_US').name, 'New knife')
        self.assertEqual(self.test1.with_context(lang='fr_FR').name, 'Couteau')
        self.assertEqual(self.test2.with_context(lang='en_US').name, 'New knife')
        self.assertEqual(self.test2.with_context(lang='fr_FR').name, 'Couteau')
        self.test1.with_context(lang='fr_FR').name = 'Nouveau couteau'
        self.assertEqual(self.test1.with_context(lang='en_US').name, 'New knife')
        self.assertEqual(self.test1.with_context(lang='fr_FR').name, 'Nouveau couteau')
        self.assertEqual(self.test2.with_context(lang='en_US').name, 'New knife')
        self.assertEqual(self.test2.with_context(lang='fr_FR').name, 'Nouveau couteau')

    def test_write_from_related(self):
        self.test2.with_context(lang='en_US').name = 'New knife'
        self.assertEqual(self.test1.with_context(lang='en_US').name, 'New knife')
        self.assertEqual(self.test1.with_context(lang='fr_FR').name, 'Couteau')
        self.assertEqual(self.test2.with_context(lang='en_US').name, 'New knife')
        self.assertEqual(self.test2.with_context(lang='fr_FR').name, 'Couteau')
        self.test2.with_context(lang='fr_FR').name = 'Nouveau couteau'
        self.assertEqual(self.test1.with_context(lang='en_US').name, 'New knife')
        self.assertEqual(self.test1.with_context(lang='fr_FR').name, 'Nouveau couteau')
        self.assertEqual(self.test2.with_context(lang='en_US').name, 'New knife')
        self.assertEqual(self.test2.with_context(lang='fr_FR').name, 'Nouveau couteau')

    def test_write_from_ir_translation(self):
        translation_fr = self.test1.env['ir.translation'].search([('name', '=', 'test.model.1,name'), ('res_id', '=', self.test1.id), ('lang', '=', 'fr_FR')])
        self.assertEqual(self.test2.with_context(lang='fr_FR').name, 'Couteau')
        translation_fr.value = 'Nouveau couteau'
        self.assertEqual(self.test2.with_context(lang='fr_FR').name, 'Nouveau couteau')

    def test_write_from_ir_translation_term(self):
        translation_fr = self.test1.env['ir.translation'].search([('name', '=', 'test.model.1,html'), ('res_id', '=', self.test1.id), ('lang', '=', 'fr_FR'), ('value', '=', 'Couteau')])
        self.assertEqual(self.test2.with_context(lang='fr_FR').html, '<p>Couteau</p><p>Fourchette</p><p>Cuiller</p>')
        translation_fr.value = 'Nouveau couteau'
        self.assertEqual(self.test2.with_context(lang='fr_FR').html, '<p>Nouveau couteau</p><p>Fourchette</p><p>Cuiller</p>')

    def test_import_from_po(self):
        self.assertEqual(self.test2.with_context(lang='fr_FR').name, 'Couteau')
        test1_xml_id = self.test1.export_data(['id']).get('datas')[0][0]
        po_string = '''
                #. module: __export__
                #: model:test.model.1,name:%s
                msgid "Knife"
                msgstr "Nouveau couteau"
                ''' % test1_xml_id
        with io.BytesIO(bytes(po_string, encoding='utf-8')) as f:
            f.name = 'dummy'
            trans_load_data(self.test1.env.cr, f, 'po', 'fr_FR', verbose=True, create_empty_translation=False, overwrite=True)
        self.assertEqual(self.test2.with_context(lang='fr_FR').name, 'Nouveau couteau')
