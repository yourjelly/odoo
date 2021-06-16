# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.mail.tests import common
from odoo.tests import tagged, users


@tagged('mail_render')
class TestMailRender(common.MailCommon):

    @classmethod
    def setUpClass(cls):
        super(TestMailRender, cls).setUpClass()

        # activate multi language support
        cls.env['res.lang']._activate_lang('fr_FR')
        cls.user_admin.write({'lang': 'en_US'})

        # test records
        cls.render_object = cls.env['res.partner'].create({
            'name': 'TestRecord',
            'lang': 'en_US',
        })
        cls.render_object_fr = cls.env['res.partner'].create({
            'name': 'Element de Test',
            'lang': 'fr_FR',
        })

        # some qweb templates, their views and their xml ids
        cls.base_qweb_bits = [
            '<p>Hello</p>',
            '<p>Hello <t t-esc="object.name"/></p>',
            """<p>
    <span t-if="object.lang == 'en_US'">English Speaker</span>
    <span t-else="">Other Speaker</span>
</p>"""
        ]
        cls.base_qweb_bits_fr = [
            '<p>Bonjour</p>',
            '<p>Bonjour <t t-esc="object.name"/></p>',
            """<p>
    <span t-if="object.lang == 'en_US'">Narrateur Anglais</span>
    <span t-else="">Autre Narrateur</span>
</p>"""
        ]
        cls.base_qweb_templates = cls.env['ir.ui.view'].create([
            {'name': 'TestRender%d' % index,
             'type': 'qweb',
             'arch': qweb_content,
            } for index, qweb_content in enumerate(cls.base_qweb_bits)
        ])
        cls.base_qweb_templates_data = cls.env['ir.model.data'].create([
            {'name': template.name, 'module': 'mail',
             'model': template._name, 'res_id': template.id,
            } for template in cls.base_qweb_templates
        ])
        cls.base_qweb_templates_xmlids = [
            model_data.complete_name
            for model_data in cls.base_qweb_templates_data
        ]

        # render result
        cls.base_rendered = [
            '<p>Hello</p>',
            '<p>Hello %s</p>' % cls.render_object.name,
            """<p>
    <span>English Speaker</span>
</p>"""
        ]
        cls.base_rendered_fr = [
            '<p>Bonjour</p>',
            '<p>Bonjour %s</p>' % cls.render_object_fr.name,
            """<p>
    <span>Autre Narrateur</span>
</p>"""
        ]

        # link to mail template
        cls.test_template_small_qweb = cls.env['mail.template'].create({
            'name': 'Test Template',
            'subject': cls.base_qweb_bits[0],
            'body_html': cls.base_qweb_bits[1],
            'model_id': cls.env['ir.model']._get('res.partner').id,
            'lang': '${object.lang}'
        })

        # some translations
        cls.env['ir.translation'].create({
            'type': 'model',
            'name': 'mail.template,subject',
            'lang': 'fr_FR',
            'res_id': cls.test_template_small_qweb.id,
            'src': cls.test_template_small_qweb.subject,
            'value': cls.base_qweb_bits_fr[0],
        })
        cls.env['ir.translation'].create({
            'type': 'model',
            'name': 'mail.template,body_html',
            'lang': 'fr_FR',
            'res_id': cls.test_template_small_qweb.id,
            'src': cls.test_template_small_qweb.body_html,
            'value': cls.base_qweb_bits_fr[1],
        })
        cls.env['ir.model.data'].create({
            'name': 'test_template_xmlid',
            'module': 'mail',
            'model': cls.test_template_small_qweb._name,
            'res_id': cls.test_template_small_qweb.id,
        })

    @users('employee')
    def test_evaluation_context(self):
        """ Test evaluation context and various ways of tweaking it. """
        partner = self.env['res.partner'].browse(self.render_object.ids)
        MailRenderMixin = self.env['mail.render.mixin']

        custom_ctx = {'custom_ctx': 'Custom Context Value'}
        add_context = {
            'custom_value': 'Custom Render Value'
        }
        srces = [
            '<b>I am ${user.name}</b>',
            '<span>Datetime is ${format_datetime(datetime.datetime(2021, 6, 1), dt_format="MM - d - YYY")}</span>',
            '<span>Context ${ctx.get("custom_ctx")}, value ${custom_value}</span>',
        ]
        results = [
            '<b>I am %s</b>' % self.env.user.name,
            '<span>Datetime is 06 - 1 - 2021</span>',
            '<span>Context Custom Context Value, value Custom Render Value</span>'
        ]
        for src, expected in zip(srces, results):
            for engine in ['small_qweb']:
                result = MailRenderMixin.with_context(**custom_ctx)._render_template(
                    src, partner._name, partner.ids,
                    engine=engine, add_context=add_context
                )[partner.id]
                self.assertEqual(expected, result)

    @users('employee')
    def test_render_mail_template_small_qweb(self):
        template = self.env['mail.template'].browse(self.test_template_small_qweb.ids)
        partner = self.env['res.partner'].browse(self.render_object.ids)
        for fname, expected in zip(['subject', 'body_html'], self.base_rendered):
            rendered = str(template._render_field(
                fname,
                partner.ids,
                compute_lang=True,
                engine='qweb',
            )[partner.id])
            self.assertEqual(rendered, expected)

        partner = self.env['res.partner'].browse(self.render_object_fr.ids)
        for fname, expected in zip(['subject', 'body_html'], self.base_rendered_fr):
            rendered = str(template._render_field(
                fname,
                partner.ids,
                compute_lang=True,
                engine='qweb',
            )[partner.id])
            self.assertEqual(rendered, expected)

    @users('employee')
    def test_render_template_qweb(self):
        partner = self.env['res.partner'].browse(self.render_object.ids)
        for source, expected in zip(self.base_qweb_bits, self.base_rendered):
            rendered = str(self.env['mail.render.mixin']._render_template(
                source,
                partner._name,
                partner.ids,
                engine='qweb',
            )[partner.id])
            self.assertEqual(rendered, expected)

    @users('employee')
    def test_render_template_qweb_view(self):
        partner = self.env['res.partner'].browse(self.render_object.ids)
        for source, expected in zip(self.base_qweb_templates_xmlids, self.base_rendered):
            rendered = self.env['mail.render.mixin']._render_template(
                source,
                partner._name,
                partner.ids,
                engine='qweb_view',
            )[partner.id].decode()
            self.assertEqual(rendered, expected)

    @users('employee')
    def test_template_rendering_impersonate(self):
        """ Test that the use of SUDO do not change the current user. """
        partner = self.env['res.partner'].browse(self.render_object.ids)
        src = '${user.name} - ${object.name}'
        expected = '%s - %s' % (self.env.user.name, partner.name)
        result = self.env['mail.render.mixin'].sudo()._render_template_small_qweb(
            src, partner._name, partner.ids
        )[partner.id]
        self.assertIn(expected, result)

    @users('employee')
    def test_template_rendering_function_call(self):
        """Test the case when the template call a custom function.
        This function should not be called when the template is not rendered.
        """
        partner = self.env['res.partner'].browse(self.render_object.ids)

        def cust_function():
            # Can not use "MagicMock" in a Jinja sand-boxed environment
            # so create our own function
            cust_function.call = True
            return 'return value'

        cust_function.call = False

        src = """<h1>This is a test</h1>
<p>${cust_function()}</p>"""
        expected = """<h1>This is a test</h1>
<p>return value</p>"""
        context = {'cust_function': cust_function}

        result = self.env['mail.render.mixin']._render_template_small_qweb(
            src, partner._name, partner.ids,
            add_context=context
        )[partner.id]
        self.assertEqual(expected, result)
        self.assertTrue(cust_function.call)

    @users('employee')
    def test_template_rendering_various(self):
        """ Test static rendering """
        partner = self.env['res.partner'].browse(self.render_object.ids)
        MailRenderMixin = self.env['mail.render.mixin']

        # static string
        src = 'This is a string'
        expected = 'This is a string'
        for engine in ['small_qweb']:
            result = MailRenderMixin._render_template(
                src, partner._name, partner.ids, engine=engine,
            )[partner.id]
            self.assertEqual(expected, result)

        # code string
        src = 'This is a string with a number ${13+13}'
        expected = 'This is a string with a number 26'
        for engine in ['small_qweb']:
            result = MailRenderMixin._render_template(
                src, partner._name, partner.ids, engine=engine,
            )[partner.id]
            self.assertEqual(expected, result)

        # block string
        src = "This is a string with a block ${'hidden' if False else 'displayed'}"
        expected = 'This is a string with a block displayed'
        for engine in ['small_qweb']:
            result = MailRenderMixin._render_template(
                src, partner._name, partner.ids, engine=engine,
            )[partner.id]
            self.assertEqual(expected, result)

        # static xml
        src = '<p class="text-muted"><span>This is a string</span></p>'
        expected = '<p class="text-muted"><span>This is a string</span></p>'
        for engine in ['small_qweb', 'qweb']:
            result = MailRenderMixin._render_template(
                src, partner._name, partner.ids, engine=engine,
            )[partner.id]
            self.assertEqual(expected, result.decode() if engine == 'qweb_view' else str(result))  # tde: checkme

        # code xml
        srces = [
            '<p class="text-muted"><span>This is a string with a number ${13+13}</span></p>',
            '<p class="text-muted"><span>This is a string with a number <t t-out="13+13"/></span></p>',
        ]
        expected = '<p class="text-muted"><span>This is a string with a number 26</span></p>'
        for engine, src in zip(['small_qweb', 'qweb'], srces):
            result = MailRenderMixin._render_template(
                src, partner._name, partner.ids, engine=engine,
            )[partner.id]
            self.assertEqual(expected, result.decode() if engine == 'qweb_view' else str(result))
