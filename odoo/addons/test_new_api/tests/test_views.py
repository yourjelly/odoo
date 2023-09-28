# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common, Form
from odoo.exceptions import ValidationError
from lxml import etree


class TestDefaultView(common.TransactionCase):

    def test_default_form_view(self):
        self.assertEqual(
            etree.tostring(self.env['test_new_api.message']._get_default_form_view()),
            b'<form><sheet string="Test New API Message"><group><group><field name="discussion"/></group></group><group><field name="body"/></group><group><group><field name="author"/><field name="display_name"/><field name="double_size"/><field name="author_partner"/><field name="label"/><field name="active"/></group><group><field name="name"/><field name="size"/><field name="discussion_name"/><field name="important"/><field name="priority"/><field name="attributes"/></group></group><group><separator/></group></sheet></form>'
        )
        self.assertEqual(
            etree.tostring(self.env['test_new_api.creativework.edition']._get_default_form_view()),
            b'<form><sheet string="Test New API Creative Work Edition"><group><group><field name="name"/><field name="res_model_id"/></group><group><field name="res_id"/><field name="res_model"/></group></group><group><separator/></group></sheet></form>'
        )
        self.assertEqual(
            etree.tostring(self.env['test_new_api.mixed']._get_default_form_view()),
            b'<form><sheet string="Test New API Mixed"><group><group><field name="number"/><field name="date"/><field name="now"/><field name="reference"/></group><group><field name="number2"/><field name="moment"/><field name="lang"/></group></group><group><field name="comment1"/></group><group><field name="comment2"/></group><group><field name="comment3"/></group><group><field name="comment4"/></group><group><field name="comment5"/></group><group><group><field name="currency_id"/></group><group><field name="amount"/></group></group><group><separator/></group></sheet></form>'
        )


class TestViewGroups(common.TransactionCase):
    def test_attrs_groups(self):
        """ Checks that attrs/modifiers with groups work
        """
        f = Form(self.env['test_new_api.model.some_access'], view='test_new_api.view_model_some_access')
        f.a = 1
        f.b = 2
        with self.assertRaises(AssertionError):
            f.c = 3
        with self.assertRaises(AssertionError):
            f.e = 3
        with self.assertRaises(AssertionError):
            f.f = 3

        with self.assertRaises(ValidationError):
            # create must fail because 'a' and the model has no 'base.group_portal'
            self.env['ir.ui.view'].create({
                'name': 'stuff',
                'model': 'test_new_api.model.some_access',
                'arch': """
                    <form>
                        <field name="a" readonly="j"/>
                    </form>
                """,
            })

        with self.assertRaises(ValidationError):
            # a: base.group_no_one > -
            # d: base.group_no_one > base.group_erp_manager
            self.env['ir.ui.view'].create({
                'name': 'stuff',
                'model': 'test_new_api.model.some_access',
                'arch': """
                    <form>
                        <field name="a" readonly="d"/>
                    </form>
                """,
            })

        with self.assertRaises(ValidationError):
            # e: base.group_no_one > base.group_erp_manager,base.group_portal
            # d: base.group_no_one > base.group_erp_manager
            self.env['ir.ui.view'].create({
                'name': 'stuff',
                'model': 'test_new_api.model.some_access',
                'arch': """
                    <form>
                        <field name="d"/>
                        <field name="e" readonly="d"/>
                    </form>
                """,
            })

        with self.assertRaises(ValidationError):
            # i: base.group_no_one > !base.group_portal
            # h: base.group_no_one > base.group_erp_manager,!base.group_portal
            self.env['ir.ui.view'].create({
                'name': 'stuff',
                'model': 'test_new_api.model.some_access',
                'arch': """
                    <form>
                        <field name="i" readonly="h"/>
                    </form>
                """,
            })

        with self.assertRaises(ValidationError):
            # i: base.group_no_one > !base.group_portal
            # j: base.group_no_one > base.group_portal
            self.env['ir.ui.view'].create({
                'name': 'stuff',
                'model': 'test_new_api.model.some_access',
                'arch': """
                    <form>
                        <field name="i" readonly="j"/>
                    </form>
                """,
            })

        with self.assertRaises(ValidationError):
            # i: base.group_no_one > !base.group_portal
            # h: base.group_no_one > base.group_portal
            self.env['ir.ui.view'].create({
                'name': 'stuff',
                'model': 'test_new_api.model.all_access',
                'arch': """
                    <form>
                        <field name="ab" readonly="cd"/>
                    </form>
                """,
            })

    def test_tree(self):
        view = self.env.ref('test_new_api.view_model_some_access_tree')
        arch = self.env['test_new_api.model.some_access'].get_views([(view.id, 'tree')])['views']['tree']['arch']
        tree = etree.fromstring(arch)

        nodes = tree.xpath("//tree/field[@name='a'][@invisible='True'][@readonly='True']")
        self.assertTrue(nodes, "tree should contains the missing field 'a'")

        nodes = tree.xpath("//groupby/field[@name='ab'][@invisible='True'][@readonly='True']")
        self.assertTrue(nodes, "groupby should contains the missing field 'ab'")

    def test_related_field_and_groups(self):
        # group from related
        with self.assertRaisesRegex(ValidationError, "base.group_public > base.group_erp_manager"):
            self.env['ir.ui.view'].create({
                'name': 'stuff',
                'model': 'test_new_api.model2.some_access',
                'arch': """
                    <form>
                        <field name="g_id"/>
                    </form>
                """,
            })

        # should not fail, the domain is not applied on xxx_sub_id
        self.env['ir.ui.view'].create({
            'name': 'stuff',
            'model': 'test_new_api.model3.some_access',
            'arch': """
                <form>
                    <field name="xxx_sub_id" groups="base.group_erp_manager"/>
                </form>
            """,
        })
