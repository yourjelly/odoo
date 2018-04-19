# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from lxml import etree

from odoo.exceptions import AccessError
from odoo.tests.common import TransactionCase
from odoo.tools.misc import mute_logger
from odoo.addons.test_base.tests.common import TransactionCaseCommon


GROUP_SYSTEM = 'base.group_system'


class TestACL(TransactionCaseCommon):

    def setUp(self):
        super(TestACL, self).setUp()
        self.erp_system_group = self.env.ref(GROUP_SYSTEM)

    def _set_field_groups(self, model, field_name, groups):
        field = model._fields[field_name]
        self.patch(field, 'groups', groups)

    def test_field_visibility_restriction(self):
        """Check that model-level ``groups`` parameter effectively restricts access to that
           field for users who do not belong to one of the explicitly allowed groups"""
        test_base = self.env['test.base'].sudo(self.user_test)

        # Verify the test environment first
        original_fields = test_base.fields_get([])
        form_view = test_base.fields_view_get(False, 'form')
        view_arch = etree.fromstring(form_view.get('arch'))
        has_group_system = self.user_test.has_group(GROUP_SYSTEM)
        self.assertFalse(has_group_system, "`demo` user should not belong to the restricted group before the test")
        self.assertIn('parent_id', original_fields, "'parent_id' field must be properly visible before the test")
        self.assertNotEquals(view_arch.xpath("//field[@name='parent_id']"), [],
                             "Field 'parent_id' must be found in view definition before the test")

        # restrict access to the field and check it's gone
        self._set_field_groups(test_base, 'parent_id', GROUP_SYSTEM)

        fields = test_base.fields_get([])
        form_view = test_base.fields_view_get(False, 'form')
        view_arch = etree.fromstring(form_view.get('arch'))
        self.assertNotIn('parent_id', fields, "'parent_id' field should be gone")
        self.assertEquals(view_arch.xpath("//field[@name='parent_id']"), [],
                          "Field 'parent_id' must not be found in view definition")

        # Make demo user a member of the restricted group and check that the field is back
        self.erp_system_group.users += self.user_test
        has_group_system = self.user_test.has_group(GROUP_SYSTEM)
        fields = test_base.fields_get([])
        form_view = test_base.fields_view_get(False, 'form')
        view_arch = etree.fromstring(form_view.get('arch'))
        self.assertTrue(has_group_system, "`demo` user should now belong to the restricted group")
        self.assertIn('parent_id', fields, "'parent_id' field must be properly visible again")
        self.assertNotEquals(view_arch.xpath("//field[@name='parent_id']"), [],
                             "Field 'parent_id' must be found in view definition again")

    @mute_logger('odoo.models')
    def test_field_crud_restriction(self):
        "Read/Write RPC access to restricted field should be forbidden"
        test_base = self.env['test.base'].browse(1).sudo(self.user_test)

        # Verify the test environment first
        has_group_system = self.user_test.has_group(GROUP_SYSTEM)
        self.assertFalse(has_group_system, "`demo` user should not belong to the restricted group")
        self.assert_(test_base.read(['color']))
        self.assert_(test_base.write({'color': 1}))

        # Now restrict access to the field and check it's forbidden
        self._set_field_groups(test_base, 'color', GROUP_SYSTEM)

        with self.assertRaises(AccessError):
            test_base.read(['color'])
        with self.assertRaises(AccessError):
            test_base.write({'color': 1})

        # Add the restricted group, and check that it works again
        self.erp_system_group.users += self.user_test
        has_group_system = self.user_test.has_group(GROUP_SYSTEM)
        self.assertTrue(has_group_system, "`demo` user should now belong to the restricted group")
        self.assert_(test_base.read(['color']))
        self.assert_(test_base.write({'color': 1}))

    @mute_logger('odoo.models')
    def test_fields_browse_restriction(self):
        """Test access to records having restricted fields"""
        test_base = self.env['test.base'].sudo(self.user_test)
        self._set_field_groups(test_base, 'parent_id', GROUP_SYSTEM)

        # accessing fields must no raise exceptions...
        test_base = test_base.search([], limit=1)
        test_base.name
        # ... except if they are restricted
        with self.assertRaises(AccessError):
            with mute_logger('odoo.models'):
                test_base.parent_id

    def test_view_create_edit_button_invisibility(self):
        """ Test form view Create, Edit, Delete button visibility based on access right of model"""
        methods = ['create', 'edit', 'delete']
        test_base_only_read = self.env['test.base.only.read'].sudo(self.user_test)
        base_restricted_view = test_base_only_read.fields_view_get(False, 'form')
        view_arch = etree.fromstring(base_restricted_view['arch'])
        for method in methods:
            self.assertEqual(view_arch.get(method), 'false')

    def test_view_create_edit_button_visibility(self):
        """ Test form view Create, Edit, Delete button visibility based on access right of model"""
        self.erp_system_group.users += self.user_test
        methods = ['create', 'edit', 'delete']
        test_base_only_read = self.env['test.base.only.read'].sudo(self.user_test)
        base_restricted_view = test_base_only_read.fields_view_get(False, 'form')
        view_arch = etree.fromstring(base_restricted_view['arch'])
        for method in methods:
            self.assertIsNone(view_arch.get(method))

    def test_m2o_field_create_edit_invisibility(self):
        """ Test many2one field Create and Edit option visibility based on access rights of relation field"""
        methods = ['create', 'write']
        test_base = self.env['test.base'].sudo(self.user_test)
        test_base_view = test_base.fields_view_get(False, 'form')
        view_arch = etree.fromstring(test_base_view['arch'])
        field_node = view_arch.xpath("//field[@name='test_only_read']")
        self.assertTrue(len(field_node), "test_only_read field should be in test_base from view")
        for method in methods:
            self.assertEqual(field_node[0].get('can_' + method), 'false')

    def test_m2o_field_create_edit_visibility(self):
        """ Test many2one field Create and Edit option visibility based on access rights of relation field"""
        self.erp_system_group.users += self.user_test
        methods = ['create', 'write']
        test_base = self.env['test.base'].sudo(self.user_test)
        test_base_view = test_base.fields_view_get(False, 'form')
        view_arch = etree.fromstring(test_base_view['arch'])
        field_node = view_arch.xpath("//field[@name='test_only_read']")
        self.assertTrue(len(field_node), "test_only_read field should be in test_base from view")
        for method in methods:
            self.assertEqual(field_node[0].get('can_' + method), 'true')


class TestIrRule(TransactionCaseCommon):

    def test_ir_rule(self):
        model_test_base = self.env.ref('test_base.model_test_base')
        group_user = self.env.ref('base.group_user')

        # create an ir_rule for the Employee group with an blank domain
        rule1 = self.env['ir.rule'].create({
            'name': 'test_rule1',
            'model_id': model_test_base.id,
            'domain_force': False,
            'groups': [(6, 0, group_user.ids)],
        })

        # read as demo user the test_base (one blank domain)
        TestBase_demo = self.env['test.base'].sudo(self.user_test)
        test_bases = TestBase_demo.search([])
        self.assertTrue(test_bases, "Demo user should see some records.")

        # same with domain 1=1
        rule1.domain_force = "[(1,'=',1)]"
        test_bases = TestBase_demo.search([])
        self.assertTrue(test_bases, "Demo user should see some records.")

        # same with domain []
        rule1.domain_force = "[]"
        test_bases = TestBase_demo.search([])
        self.assertTrue(test_bases, "Demo user should see some records.")

        # create another ir_rule for the Employee group (to test multiple rules)
        rule2 = self.env['ir.rule'].create({
            'name': 'test_rule2',
            'model_id': model_test_base.id,
            'domain_force': False,
            'groups': [(6, 0, group_user.ids)],
        })

        # read as demo user with domains [] and blank
        test_bases = TestBase_demo.search([])
        self.assertTrue(test_bases, "Demo user should see some records.")

        # same with domains 1=1 and blank
        rule1.domain_force = "[(1,'=',1)]"
        test_bases = TestBase_demo.search([])
        self.assertTrue(test_bases, "Demo user should see some records.")

        # same with domains 1=1 and 1=1
        rule2.domain_force = "[(1,'=',1)]"
        test_bases = TestBase_demo.search([])
        self.assertTrue(test_bases, "Demo user should see some records.")

        # create another ir_rule for the Employee group (to test multiple rules)
        rule3 = self.env['ir.rule'].create({
            'name': 'test_rule3',
            'model_id': model_test_base.id,
            'domain_force': False,
            'groups': [(6, 0, group_user.ids)],
        })

        # read the test_base as demo user
        test_bases = TestBase_demo.search([])
        self.assertTrue(test_bases, "Demo user should see some records.")

        # same with domains 1=1, 1=1 and 1=1
        rule3.domain_force = "[(1,'=',1)]"
        test_bases = TestBase_demo.search([])
        self.assertTrue(test_bases, "Demo user should see some records.")

        # modify the global rule on res_company which triggers a recursive check
        # of the rules on company
        global_rule = self.env.ref('base.res_company_rule_employee')
        global_rule.domain_force = "[('id','child_of',[user.company_id.id])]"

        # read as demo user (exercising the global company rule)
        test_bases = TestBase_demo.search([])
        self.assertTrue(test_bases, "Demo user should see some records.")

        # Modify the ir_rule for employee to have a rule that fordids seeing any
        # record. We use a domain with implicit AND operator for later tests on
        # normalization.
        rule2.domain_force = "[('id','=',False),('name','=',False)]"

        # check that demo user still sees test_base, because group-rules are OR'ed
        test_bases = TestBase_demo.search([])
        self.assertTrue(test_bases, "Demo user should see some records.")

        # create a new group with demo user in it, and a complex rule
        group_test = self.env['res.groups'].create({
            'name': 'Test Group',
            'users': [(6, 0, self.user_test.ids)],
        })

        # add the rule to the new group, with a domain containing an implicit
        # AND operator, which is more tricky because it will have to be
        # normalized before combining it
        rule3.write({
            'domain_force': "[('name','!=',False),('id','!=',False)]",
            'groups': [(6, 0, group_test.ids)],
        })

        # read the test_base again as demo user, which should give results
        test_bases = TestBase_demo.search([])
        self.assertTrue(test_bases, "Demo user should see records even with the combined rules.")

        # delete global domains (to combine only group domains)
        self.env['ir.rule'].search([('groups', '=', False)]).unlink()

        # read the test_base as demo user (several group domains, no global domain)
        test_bases = TestBase_demo.search([])
        self.assertTrue(test_bases, "Demo user should see some records.")
