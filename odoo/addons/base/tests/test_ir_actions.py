# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from psycopg2 import IntegrityError

import odoo
from odoo.exceptions import UserError, ValidationError
from odoo.tools import mute_logger
from odoo.tests import common


class TestServerActionsBase(common.TransactionCase):

    def setUp(self):
        super(TestServerActionsBase, self).setUp()

        # Data on which we will run the server action
        self.test_module_category = self.env['ir.module.category'].create({
            'name': 'TestingModuleCategory',
            'description': 'TestDescription'
        })
        self.test_module = self.env['ir.module.module'].create({
            'name': 'TestingModule',
            'shortdesc': 'Test',
            'category_id': self.test_module_category.id,
        })
        self.context = {
            'active_model': 'ir.module.category',
            'active_id': self.test_module_category.id,
        }

        # Model data
        Model = self.env['ir.model']
        Fields = self.env['ir.model.fields']
        self.ir_module_model = Model.search([('model', '=', 'ir.module.module')])
        self.ir_module_name_field = Fields.search([('model', '=', 'ir.module.module'), ('name', '=', 'name')])
        self.ir_module_shortdesc_field = Fields.search([('model', '=', 'ir.module.module'), ('name', '=', 'shortdesc')])
        self.ir_module_category_field = Fields.search([('model', '=', 'ir.module.module'), ('name', '=', 'category_id')])
        self.ir_module_category_parent_field = Fields.search([('model', '=', 'ir.module.category'), ('name', '=', 'parent_id')])
        self.ir_module_category_model = Model.search([('model', '=', 'ir.module.category')])
        self.ir_module_category_name_field = Fields.search([('model', '=', 'ir.module.category'), ('name', '=', 'name')])
        self.ir_module_category_description_field = Fields.search([('model', '=', 'ir.module.category'), ('name', '=', 'description')])

        # create server action to
        self.action = self.env['ir.actions.server'].create({
            'name': 'TestAction',
            'model_id': self.ir_module_category_model.id,
            'state': 'code',
            'code': 'record.write({"description": "Mydescription"})',
        })


class TestServerActions(TestServerActionsBase):

    def test_00_action(self):
        self.action.with_context(self.context).run()
        self.assertEqual(self.test_module_category.description, 'Mydescription', 'ir_actions_server: invalid condition check')
        self.test_module_category.write({'description': False})

        # Do: create contextual action
        self.action.create_action()
        self.assertEqual(self.action.binding_model_id.model, 'ir.module.category')

        # Do: remove contextual action
        self.action.unlink_action()
        self.assertFalse(self.action.binding_model_id)

    def test_10_code(self):
        self.action.write({
            'state': 'code',
            'code': ("module_category_name = record.name + '_code'\n"
                     "record.env['ir.module.category'].create({'name': module_category_name})"),
        })
        run_res = self.action.with_context(self.context).run()
        self.assertFalse(run_res, 'ir_actions_server: code server action correctly finished should return False')

        partners = self.test_module_category.search([('name', 'ilike', 'TestingModuleCategory_code')])
        self.assertEqual(len(partners), 1, 'ir_actions_server: 1 new Module category should have been created')

    def test_20_crud_create(self):
        _description = 'Testdescription'
        _name = 'TestNew'

        # Do: create a new record in the same model and link it
        self.action.write({
            'state': 'object_create',
            'crud_model_id': self.action.model_id.id,
            'link_field_id': self.ir_module_category_parent_field.id,
            'fields_lines': [(0, 0, {'col1': self.ir_module_category_name_field.id, 'value': _name}),
                             (0, 0, {'col1': self.ir_module_category_description_field.id, 'value': _description})],
        })
        run_action = self.action.with_context(self.context).run()
        self.assertFalse(run_action, 'ir_actions_server: create record action correctly finished should return False')
        # Test: new module_category created
        module_category = self.test_module_category.search([('name', 'ilike', _name)])
        self.assertEqual(len(module_category), 1, 'ir_actions_server: TODO')
        self.assertEqual(module_category.description, _description, 'ir_actions_server: TODO')
        # Test: new partner linked
        self.assertEqual(self.test_module_category.parent_id, module_category, 'ir_actions_server: TODO')

        # Do: create a new record in another model
        self.action.write({
            'state': 'object_create',
            'crud_model_id': self.ir_module_model.id,
            'link_field_id': False,
            'fields_lines': [(5,),
                             (0, 0, {'col1': self.ir_module_name_field.id, 'value': 'record.name', 'type': 'equation'}),
                             (0, 0, {'col1': self.ir_module_shortdesc_field.id, 'value': 'record.name[0:2]', 'type': 'equation'})],
        })
        run_action = self.action.with_context(self.context).run()
        self.assertFalse(run_action, 'ir_actions_server: create record action correctly finished should return False')
        # Test: new country created
        module = self.test_module.search([('name', 'ilike', 'TestingModuleCategory')])
        self.assertEqual(len(module), 1, 'ir_actions_server: TODO')
        self.assertEqual(module.shortdesc, 'Te', 'ir_actions_server: TODO')

    def test_30_crud_write(self):
        _name = 'TestNew'

        # Do: update partner name
        self.action.write({
            'state': 'object_write',
            'fields_lines': [(0, 0, {'col1': self.ir_module_category_name_field.id, 'value': _name})],
        })
        run_action = self.action.with_context(self.context).run()
        self.assertFalse(run_action, 'ir_actions_server: create record action correctly finished should return False')
        # Test: partner updated
        module_category = self.test_module_category.search([('name', 'ilike', _name)])
        self.assertEqual(len(module_category), 1, 'ir_actions_server: TODO')
        self.assertEqual(module_category.description, 'TestDescription', 'ir_actions_server: TODO')

    @mute_logger('odoo.addons.base.models.ir_model', 'odoo.models')
    def test_40_multi(self):
        # Data: 2 server actions that will be nested
        action1 = self.action.create({
            'name': 'Subaction1',
            'sequence': 1,
            'model_id': self.ir_module_category_model.id,
            'state': 'code',
            'code': 'action = {"type": "ir.actions.act_window"}',
        })
        action2 = self.action.create({
            'name': 'Subaction2',
            'sequence': 2,
            'model_id': self.ir_module_category_model.id,
            'crud_model_id': self.ir_module_category_model.id,
            'state': 'object_create',
            'fields_lines': [(0, 0, {'col1': self.ir_module_category_name_field.id, 'value': 'RaoulettePoiluchette'}),
                             (0, 0, {'col1': self.ir_module_category_description_field.id, 'value': 'TestDescription'})],
        })
        action3 = self.action.create({
            'name': 'Subaction3',
            'sequence': 3,
            'model_id': self.ir_module_category_model.id,
            'state': 'code',
            'code': 'action = {"type": "ir.actions.act_url"}',
        })
        self.action.write({
            'state': 'multi',
            'child_ids': [(6, 0, [action1.id, action2.id, action3.id])],
        })

        # Do: run the action
        run_action = self.action.with_context(self.context).run()

        # Test: new partner created
        # currently ir_mofule_category overrides default['name'] whatever its value
        module_category = self.test_module_category.search([('name', 'ilike', 'RaoulettePoiluchette')])
        self.assertEqual(len(module_category), 1)
        # Test: action returned
        self.assertEqual(run_action.get('type'), 'ir.actions.act_url')

        # Test loops
        with self.assertRaises(ValidationError):
            self.action.write({
                'child_ids': [(6, 0, [self.action.id])]
            })


class TestActionBindings(common.TransactionCase):

    def test_bindings(self):
        """ check the action bindings on models """
        Actions = self.env['ir.actions.actions']

        # first make sure there is no bound action
        self.env.ref('base.action_partner_merge').unlink()
        bindings = Actions.get_bindings('res.partner')
        self.assertFalse(bindings['action'])
        self.assertFalse(bindings['report'])

        # create action bindings, and check the returned bindings
        action1 = self.env.ref('base.action_attachment')
        action2 = self.env.ref('base.ir_default_menu_action')
        action3 = self.env['ir.actions.report'].search([('groups_id', '=', False)], limit=1)
        action1.binding_model_id = action2.binding_model_id \
                                 = action3.binding_model_id \
                                 = self.env['ir.model']._get('res.partner')

        bindings = Actions.get_bindings('res.partner')
        self.assertItemsEqual(
            bindings['action'],
            (action1 + action2).read(),
            "Wrong action bindings",
        )
        self.assertItemsEqual(
            bindings['report'],
            action3.read(),
            "Wrong action bindings",
        )

        # add a group on an action, and check that it is not returned
        group = self.env.ref('base.group_user')
        action2.groups_id += group
        self.env.user.groups_id -= group

        bindings = Actions.get_bindings('res.partner')
        self.assertItemsEqual(
            bindings['action'],
            action1.read(),
            "Wrong action bindings",
        )
        self.assertItemsEqual(
            bindings['report'],
            action3.read(),
            "Wrong action bindings",
        )


class TestCustomFields(common.TransactionCase):
    MODEL = 'res.partner'
    COMODEL = 'res.users'

    def setUp(self):
        # check that the registry is properly reset
        registry = odoo.registry()
        fnames = set(registry[self.MODEL]._fields)
        @self.addCleanup
        def check_registry():
            assert set(registry[self.MODEL]._fields) == fnames

        super(TestCustomFields, self).setUp()

        # use a test cursor instead of a real cursor
        self.registry.enter_test_mode(self.cr)
        self.addCleanup(self.registry.leave_test_mode)

        # do not reload the registry after removing a field
        self.env = self.env(context={'_force_unlink': True})

    def create_field(self, name):
        """ create a custom field and return it """
        model = self.env['ir.model'].search([('model', '=', self.MODEL)])
        field = self.env['ir.model.fields'].create({
            'model_id': model.id,
            'name': name,
            'field_description': name,
            'ttype': 'char',
        })
        self.assertIn(name, self.env[self.MODEL]._fields)
        return field

    def create_view(self, name):
        """ create a view with the given field name """
        return self.env['ir.ui.view'].create({
            'name': 'yet another view',
            'model': self.MODEL,
            'arch': '<tree string="X"><field name="%s"/></tree>' % name,
        })

    def test_create_custom(self):
        """ custom field names must be start with 'x_' """
        with self.assertRaises(ValidationError):
            self.create_field('foo')

    def test_create_custom_o2m(self):
        """ try creating a custom o2m and then deleting its m2o inverse """
        model = self.env['ir.model'].search([('model', '=', self.MODEL)])
        comodel = self.env['ir.model'].search([('model', '=', self.COMODEL)])

        m2o_field = self.env['ir.model.fields'].create({
            'model_id': comodel.id,
            'name': 'x_my_m2o',
            'field_description': 'my_m2o',
            'ttype': 'many2one',
            'relation': self.MODEL,
        })

        o2m_field = self.env['ir.model.fields'].create({
            'model_id': model.id,
            'name': 'x_my_o2m',
            'field_description': 'my_o2m',
            'ttype': 'one2many',
            'relation': self.COMODEL,
            'relation_field': m2o_field.name,
        })

        m2o_field.unlink()
        self.assertFalse(o2m_field.exists())

    def test_create_custom_related(self):
        """ try creating a custom related then deleting its inverse """
        comodel = self.env['ir.model'].search([('model', '=', self.COMODEL)])

        field = self.create_field('x_my_char')

        related_field = self.env['ir.model.fields'].create({
            'model_id': comodel.id,
            'name': 'x_oh_boy',
            'field_description': 'x_oh_boy',
            'ttype': 'char',
            'related': 'partner_id.x_my_char',
        })

        field.unlink()
        self.assertFalse(related_field.exists())

    def test_rename_custom(self):
        """ custom field names must be start with 'x_' """
        field = self.create_field('x_foo')
        with self.assertRaises(ValidationError):
            field.name = 'foo'

    def test_create_valid(self):
        """ field names must be valid pg identifiers """
        with self.assertRaises(ValidationError):
            self.create_field('x_foo bar')

    def test_rename_valid(self):
        """ field names must be valid pg identifiers """
        field = self.create_field('x_foo')
        with self.assertRaises(ValidationError):
            field.name = 'x_foo bar'

    def test_create_unique(self):
        """ one cannot create two fields with the same name on a given model """
        self.create_field('x_foo')
        with self.assertRaises(IntegrityError), mute_logger('odoo.sql_db'):
            self.create_field('x_foo')

    def test_rename_unique(self):
        """ one cannot create two fields with the same name on a given model """
        field1 = self.create_field('x_foo')
        field2 = self.create_field('x_bar')
        with self.assertRaises(IntegrityError), mute_logger('odoo.sql_db'):
            field2.name = field1.name

    def test_remove_without_view(self):
        """ try removing a custom field that does not occur in views """
        field = self.create_field('x_foo')
        field.unlink()

    def test_rename_without_view(self):
        """ try renaming a custom field that does not occur in views """
        field = self.create_field('x_foo')
        field.name = 'x_bar'

    def test_remove_with_view(self):
        """ try removing a custom field that occurs in a view """
        field = self.create_field('x_foo')
        self.create_view('x_foo')

        # try to delete the field, this should fail but not modify the registry
        with self.assertRaises(UserError):
            field.unlink()
        self.assertIn('x_foo', self.env[self.MODEL]._fields)

    def test_rename_with_view(self):
        """ try renaming a custom field that occurs in a view """
        field = self.create_field('x_foo')
        self.create_view('x_foo')

        # try to delete the field, this should fail but not modify the registry
        with self.assertRaises(UserError):
            field.name = 'x_bar'
        self.assertIn('x_foo', self.env[self.MODEL]._fields)
