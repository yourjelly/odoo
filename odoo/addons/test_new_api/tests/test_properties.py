# -*- coding: utf-8 -*-
import json

from unittest.mock import patch

from odoo import Command
from odoo.exceptions import AccessError, CacheMiss
from odoo.tests.common import Form, TransactionCase
from odoo.tools import mute_logger


class PropertiesCase(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.user = cls.env['res.users'].search([], limit=1)
        cls.partner = cls.env['res.partner'].search([], limit=1)

        message_properties_1 = [
            {
                'id': 'name',
                'string': 'Name',
                'type': 'char',
                'default': 'Default Name',
            }, {
                'id': 'partner_id',
                'string': 'Partner',
                'type': 'many2one',
                'model': 'res.partner',
            },
        ]
        message_properties_2 = [
            {
                "id": "state",
                "type": "selection",
                "string": "Status",
                "selection": [("draft", "Draft"), ("progress", "In Progress"), ("done", "Done")],
                "default": "draft",
            }
        ]

        cls.discussion_1 = cls.env['test_new_api.discussion'].create({
            'name': 'Test Discussion',
            'message_properties': message_properties_1,
            'participants': [Command.link(cls.user.id)],
        })
        cls.discussion_2 = cls.env['test_new_api.discussion'].create({
            'name': 'Test Discussion',
            'message_properties': message_properties_2,
            'participants': [Command.link(cls.user.id)],
        })

        cls.message_1 = cls.env['test_new_api.message'].create({
            'name': 'Test Message',
            'discussion': cls.discussion_1.id,
            'author': cls.user.id,
            'custom_properties': {'name': 'Test', 'partner_id': [cls.partner.id, 'res.partner']},
        })

        cls.env.flush_all()

        cls.message_2 = cls.env['test_new_api.message'].create({
            'name': 'Test Message',
            'discussion': cls.discussion_1.id,
            'author': cls.user.id,
        })
        cls.message_3 = cls.env['test_new_api.message'].create({
            'name': 'Test Message',
            'discussion': cls.discussion_2.id,
            'author': cls.user.id,
        })

    def test_json_field(self):
        author = self.env['res.users'].search([], limit=1)

        json_values = [
            {
                'id': 'name',
                'string': 'Name',
                'type': 'char',
            }, {
                'id': 'partner_id',
                'string': 'Partner',
                'type': 'many2one',
                'model': 'res.partner',
            },
        ]

        discussion = self.env['test_new_api.discussion'].create({
            'name': 'Test Discussion',
            'json_values': json_values,
            'participants': [Command.link(author.id)],
        })

        self._flush_and_invalidate()

        self.assertTrue(isinstance(discussion.json_values, list))
        self.assertEqual(discussion.json_values, json_values)

        discussion.json_values = '{"test": 3}'
        self.assertEqual(
            discussion.json_values, {"test": 3},
            msg='JSON must be parsed when loaded from cache')

        discussion.invalidate_recordset()

        self.assertEqual(discussion.json_values, {"test": 3})

    def test_properties_field(self):
        message_1, message_2, message_3 = self.message_1, self.message_2, self.message_3
        partner = self.partner

        self._flush_and_invalidate()

        self.assertTrue(isinstance(message_1.custom_properties, list))
        self.assertEqual(message_1.custom_properties[0]['value'], 'Test')
        self.assertEqual(message_1.custom_properties[1]['value'], partner.id)
        self.assertEqual(message_2.custom_properties[0]['value'], 'Default Name')
        self.assertFalse(message_2.custom_properties[1]['value'])
        self.assertEqual(
            message_3.custom_properties[0]['value'], 'draft',
            msg='Should have take the default value')

        message_1.custom_properties = {
            'name': 'New name',
            'partner_id': [self.partner.id, 'res.partner'],
        }
        self.assertEqual(message_1.custom_properties[0]['value'], 'New name')

        self._flush_and_invalidate()

        self.assertEqual(message_1.custom_properties[0]['value'], 'New name')
        self.assertEqual(message_1.custom_properties[1]['value'], partner.id)

        # check that the value has been updated in the database
        value = self._get_sql_properties(message_1)
        self.assertTrue(isinstance(value, dict))
        self.assertEqual(value.get('name'), 'New name', msg='Value must be updated in the database')

        # check that we can not set unknown properties
        message_3.custom_properties = {'name': 'Test'}
        self._flush_and_invalidate()

        self.assertEqual(len(message_3.custom_properties), 1, msg='Name property does not exist for message 3')
        self.assertEqual(message_3.custom_properties[0]['id'], 'state', msg='Name property does not exist for message 3')
        self.assertFalse(message_3.custom_properties[0]['value'], msg='Name property does not exist for message 3')

        # if we write False on the field, it should still
        # return the properties definition for the web client
        message_3.custom_properties = False
        self._flush_and_invalidate()

        expected = self.discussion_2.message_properties
        for property_definition in expected:
            property_definition['value'] = None

        self.assertEqual(message_3.read(['custom_properties'])[0]['custom_properties'], expected)
        self.assertEqual(message_3.custom_properties, expected)

    def test_properties_field_write_batch_dict(self):
        """Test the behavior of the write called in batch, with a dict as value."""
        message_1, message_2, message_3 = self.message_1, self.message_2, self.message_3

        # Property "name" only exists for message 1 and 2
        # Property "state" only exists for message 3
        properties_values = {
            'name': 'write name',
            'partner_id': [self.partner.id, 'res.partner'],
            'state': 'done',
        }

        (message_1 | message_3).write({'custom_properties': properties_values})

        self.assertEqual(
            self._get_sql_properties(message_1),
            {'name': 'write name', 'partner_id': [self.partner.id, 'res.partner']})
        self.assertEqual(self._get_sql_properties(message_3), {'state': 'done'})

        self.assertEqual(len(message_1.custom_properties), 2)
        self.assertEqual(message_1.custom_properties[0]['value'], 'write name')
        self.assertEqual(message_1.custom_properties[1]['value'], self.partner.id)

        self.assertEqual(len(message_2.custom_properties), 2)
        self.assertEqual(message_2.custom_properties[0]['value'], 'Default Name')
        self.assertFalse(message_2.custom_properties[1]['value'])

        self.assertEqual(len(message_3.custom_properties), 1)
        self.assertEqual(message_3.custom_properties[0]['value'], 'done')

    def test_properties_field_write_batch_list(self):
        """Test the behavior of the write called in batch, with a list as value.

        Simulate a write operation done by the web client.
        """
        new_partner = self.env['res.partner'].create({'name': 'New Partner'})

        # mix both properties
        properties_values = (self.message_1 | self.message_3).read(['custom_properties'])
        properties_values = properties_values[0]['custom_properties'] + properties_values[1]['custom_properties']

        for property_definition in properties_values:
            if property_definition['id'] == 'name':
                property_definition['value'] = 'write name'
            elif property_definition['id'] == 'state':
                property_definition['value'] = 'done'
            elif property_definition['id'] == 'partner_id':
                property_definition['value'] = [new_partner.id, new_partner._name]

        (self.message_1 | self.message_3).write({'custom_properties': properties_values})

        sql_values_1 = self._get_sql_properties(self.message_1)
        sql_values_3 = self._get_sql_properties(self.message_3)

        self.assertEqual(sql_values_1, {'name': 'write name', 'partner_id': [new_partner.id, 'res.partner']})
        self.assertEqual(sql_values_3, {'state': 'done'})

    def test_properties_field_create_batch(self):
        with self.assertQueryCount(8):
            messages = self.env['test_new_api.message'].create([{
                'name': 'Test Message',
                'discussion': self.discussion_1.id,
                'author': self.user.id,
                'custom_properties': {
                    'name': 'Test',
                    'partner_id': [self.partner.id, 'res.partner'],
                },
            }, {
                'name': 'Test Message',
                'discussion': self.discussion_2.id,
                'author': self.user.id,
                'custom_properties': {
                    'name': 'Test',  # do not exists on discussion 2, should be removed
                },
            }])

        self.assertEqual(len(messages), 2)

        properties_values_1 = messages[0].custom_properties
        properties_values_2 = messages[1].custom_properties

        self.assertEqual(len(properties_values_1), 2, msg='Discussion 1 has 2 properties')
        self.assertEqual(len(properties_values_2), 1, msg='Discussion 2 has 1 properties')

        self.assertEqual(properties_values_1[0]['value'], 'Test')
        self.assertEqual(properties_values_1[1]['value'], self.partner.id)
        self.assertEqual(properties_values_2[0]['value'], 'draft', msg='Should have take the default value')

    def test_properties_field_default(self):
        message = self.env['test_new_api.message'].create({
            'name': 'Test Message',
            'discussion': self.discussion_2.id,
            'author': self.user.id,
        })
        self.assertEqual(
            message.custom_properties[0]['value'],
            'draft',
            msg='Should have take the default value')

        message.custom_properties = {'state': None}
        self.assertFalse(
            message.custom_properties[0]['value'],
            msg='Writing None should not reset the default value')

        # test the case where the parent come from a default as well
        self.env['test_new_api.message']._fields['discussion'].default = lambda __: self.discussion_2.id
        message = self.env['test_new_api.message'].create({
            'name': 'Test Message',
            'author': self.user.id,
        })
        self.assertEqual(message.discussion, self.discussion_2)
        self.assertEqual(
            message.custom_properties[0]['value'],
            'draft',
            msg='Should have take the default value')

        # the parent come from a default value
        self.discussion_2.message_properties = [{'id': 'test', 'type': 'char', 'default': 'default char'}]
        default_values = self.env['test_new_api.message'].default_get(
            ['discussion', 'custom_properties'])
        self.assertEqual(default_values.get('discussion'), self.discussion_2.id)
        self.assertEqual(
            default_values.get('custom_properties', {}).get('test'),
            'default char')

        # test a default many2one
        self.discussion_1.message_properties = [
            {
                'id': 'my_many2one',
                'string': 'Partner',
                'model': 'res.partner',
                'type': 'many2one',
                # send the value like the web client does
                'default': [self.partner.id, 'Bob'],
            },
        ]
        sql_definition = self._get_sql_definition(self.discussion_1)
        self.assertEqual(sql_definition[0]['default'], self.partner.id)

        read_values = self.discussion_1.read(['message_properties'])[0]['message_properties']
        self.assertEqual(
            read_values[0]['default'],
            (self.partner.id, self.partner.display_name),
            msg='When reading many2one default, it should return the display name',
        )

        # read the default many2one and deactivate the name_get
        read_values = self.discussion_1.read(['message_properties'], load=None)[0]['message_properties']
        self.assertEqual(
            read_values[0]['default'],
            self.partner.id,
            msg='If the name_get is deactivate, it should not return the display name',
        )

        message = self.env['test_new_api.message'].create({
            'name': 'Test Message',
            'author': self.user.id,
            'discussion': self.discussion_1.id,
        })

        properties = message.read(['custom_properties'])[0]['custom_properties']
        self.assertEqual(properties[0]['value'], (self.partner.id, self.partner.display_name))

        self.assertEqual(message.custom_properties[0]['value'], self.partner.id)

        # give a default value and a value for a many2one
        # the default value must be ignored
        partner_2 = self.env['res.partner'].create({'name': 'Partner 2'})
        property_definition = self.discussion_1.read(['message_properties'])[0]['message_properties']
        property_definition[0]['value'] = (partner_2.id, 'Alice')
        message = self.env['test_new_api.message'].create({
            'name': 'Test Message',
            'author': self.user.id,
            'discussion': self.discussion_1.id,
            'custom_properties': property_definition,
        })
        self.assertEqual(
            message.custom_properties[0]['value'],
            partner_2.id,
            msg='Should not take the default value',
        )

    def test_properties_field_read(self):
        """Test the behavior of the read method.

        In comparison with a simple "record.properties", the read method should not
        record a recordset for the many2one, but a tuple with the record id and
        the record name_get.
        """
        properties_values = (self.message_1 | self.message_3).read(['custom_properties'])

        self.assertEqual(len(properties_values), 2)

        properties_message_1 = properties_values[0]['custom_properties']
        properties_message_3 = properties_values[1]['custom_properties']

        self.assertTrue(isinstance(properties_message_1, list))
        self.assertTrue(isinstance(properties_message_3, list))

        self.assertEqual(len(properties_message_1), 2, msg="Message 1 has 2 properties")
        self.assertEqual(len(properties_message_3), 1, msg="Message 3 has 1 property")

        self.assertEqual(
            properties_message_1[0]['id'], 'name',
            msg='First message 1 property should be "name"')
        self.assertEqual(
            properties_message_1[1]['id'], 'partner_id',
            msg='First message 1 property should be "partner_id"')
        self.assertEqual(
            properties_message_3[0]['id'], 'state',
            msg='First message 3 property should be "state"')

        many2one_property = properties_message_1[1]
        self.assertEqual(
            many2one_property['string'], 'Partner',
            msg='Parent property definition must be present when reading child')
        self.assertEqual(
            many2one_property['type'], 'many2one',
            msg='Parent property definition must be present when reading child')
        self.assertEqual(
            many2one_property['model'], 'res.partner',
            msg='Parent property definition must be present when reading child')
        self.assertEqual(many2one_property['value'], (self.partner.id, self.partner.display_name))

        # disable the name_get
        properties_values = (self.message_1 | self.message_3).read(['custom_properties'], load=None)
        many2one_property = properties_values[0]['custom_properties'][1]

        self.assertEqual(
            many2one_property['value'], self.partner.id,
            msg='If name_get is disable, should only return the record id')

    def test_properties_field_many2one_basic(self):
        """Test the basic (read, write...) of the many2one property."""
        partner = self.env['res.partner'].create({'name': 'Test Partner'})
        self.message_2.custom_properties = {'partner_id': [partner.id, 'res.partner']}

        self.assertFalse(self.message_2.custom_properties[0]['value'])
        self.assertEqual(self.message_2.custom_properties[1]['value'], partner.id)
        sql_values = self._get_sql_properties(self.message_2)
        self.assertEqual(sql_values, {'name': None, 'partner_id': [partner.id, 'res.partner']})

        # read the many2one
        properties = self.message_2.read(['custom_properties'])[0]['custom_properties']
        self.assertEqual(properties[1]['value'], (partner.id, partner.display_name))
        self.assertEqual(properties[1]['model'], 'res.partner')

    @mute_logger('odoo.models.unlink')
    def test_properties_field_many2one_unlink(self):
        """Test the case where we unlink the many2one record."""
        self.message_2.custom_properties = {'partner_id': [self.partner.id, 'res.partner']}

        # remove the partner on message 2
        self.partner.unlink()
        with self.assertQueryCount(3):
            # 1 request to read the field
            # 1 request to read the parent definition
            # 1 request to check if the many2one still exists
            self.assertFalse(self.message_2.custom_properties[0]['value'])

        # remove the partner, and use the read method
        partner = self.env['res.partner'].create({'name': 'New Partner'})
        self.message_2.custom_properties = {'partner_id': [partner.id, partner._name]}
        partner.unlink()

        expected_queries = [
            '''SELECT "test_new_api_message"."id" AS "id", "test_new_api_message"."custom_properties" AS "custom_properties" FROM "test_new_api_message" WHERE "test_new_api_message".id IN %s''',
            '''SELECT "test_new_api_message"."id" AS "id", "test_new_api_message"."discussion" AS "discussion", "test_new_api_message"."body" AS "body", "test_new_api_message"."author" AS "author", "test_new_api_message"."name" AS "name", "test_new_api_message"."important" AS "important", "test_new_api_message"."priority" AS "priority", "test_new_api_message"."custom_properties" AS "custom_properties", "test_new_api_message"."create_uid" AS "create_uid", "test_new_api_message"."create_date" AS "create_date", "test_new_api_message"."write_uid" AS "write_uid", "test_new_api_message"."write_date" AS "write_date" FROM "test_new_api_message" WHERE "test_new_api_message".id IN %s''',
            '''SELECT "test_new_api_discussion"."id" AS "id", "test_new_api_discussion"."name" AS "name", "test_new_api_discussion"."moderator" AS "moderator", "test_new_api_discussion"."message_concat" AS "message_concat", "test_new_api_discussion"."json_values" AS "json_values", "test_new_api_discussion"."message_properties" AS "message_properties", "test_new_api_discussion"."create_uid" AS "create_uid", "test_new_api_discussion"."create_date" AS "create_date", "test_new_api_discussion"."write_uid" AS "write_uid", "test_new_api_discussion"."write_date" AS "write_date" FROM "test_new_api_discussion" WHERE "test_new_api_discussion".id IN %s''',
            '''SELECT "res_partner".id FROM "res_partner" WHERE "res_partner".id IN %s''',
        ]

        with self.assertQueryCount(4), self.assertQueries(expected_queries):
            value = self.message_2.read(['custom_properties'])
            value = value[0]['custom_properties']
            self.assertFalse(value[1]['value'])
            self.assertEqual(value[1]['model'], 'res.partner')

    def test_properties_field_many2one_model_change(self):
        """Test the case where we change the model on the parent.

        Check that if we change the model on the parent, we are able to detect this
        change when we read the child properties, thanks to the model stored with
        the record ID on the child (e.g. [5, 'res.partner']).
        """
        # 2 records of 2 different models have the same id
        message = self.env['test_new_api.message'].browse(1).exists()
        partner = self.env['res.partner'].browse(1).exists()
        self.assertTrue(message and partner)

        self.discussion_1.message_properties = [{
            'id': 'message',
            'model': 'test_new_api.message',
            'type': 'many2one',
        }]
        self.message_1.custom_properties = {'message': [message.id, message._name]}

        # change the model on the parent, but do not change the property id
        self.discussion_1.message_properties = [{
            'id': 'message',
            'model': 'res.partner',
            'type': 'many2one',
        }]
        sql_definition = self._get_sql_definition(self.discussion_1)
        self.assertEqual(
            sql_definition,
            [{'id': 'message', 'model': 'res.partner', 'type': 'many2one'}])

        value = self.message_1.custom_properties[0]['value']
        self.assertNotEqual(
            value,
            partner,
            msg='Should detect that the id correspond to a different model than the original one',
        )
        self.assertFalse(value)

    def test_properties_field_many2one_model_removed(self):
        """Test the case where we uninstall a module, and the model does not exist anymore."""
        # simulate a module uninstall, the model is not available now
        # when reading the model / many2one, it should return False
        self.message_1.custom_properties = {'message': self.message_3.id}

        self.env.flush_all()
        self.env.cr.execute(
            """
            UPDATE test_new_api_discussion
               SET message_properties = '[{"id": "message", "model": "wrong_model", "type": "many2one"}]'
             WHERE id = %s
            """, (self.discussion_1.id, ),
        )
        self.env.invalidate_all()

        values = self.discussion_1.read(['message_properties'])[0]
        self.assertFalse(values['message_properties'][0]['model'])

        message_properties = self.discussion_1.message_properties
        self.assertEqual(
            message_properties,
            [{'id': 'message', 'model': False, 'type': 'many2one'}],
            msg='The model does not exist anymore, it should return false',
        )

        # read the many2one on the child, should return False as well
        self.assertFalse(self.message_1.custom_properties[0]['value'])

        values = self.message_1.read(['custom_properties'])[0]['custom_properties']
        self.assertEqual(values[0]['type'], 'many2one', msg='Property type should be preserved')
        self.assertFalse(values[0]['value'])
        self.assertFalse(values[0]['model'])

        sql_definition = self._get_sql_definition(self.discussion_1)
        self.assertEqual(
            sql_definition,
            [{'id': 'message', 'model': 'wrong_model', 'type': 'many2one'}],
            msg='Do not clean the parent model until we write on the field'
        )

        # write on the properties definition must clean the wrong model name
        self.discussion_1.message_properties = self.discussion_1.message_properties

        sql_definition = self._get_sql_definition(self.discussion_1)
        self.assertEqual(
            sql_definition,
            [{'id': 'message', 'model': False, 'type': 'many2one'}],
            msg='Should have cleaned the model key',
        )

    def test_properties_field_integer_float_boolean(self):
        self.discussion_1.message_properties = [
            {
                'id': 'int_value',
                'string': 'Int Value',
                'type': 'integer',
            }, {
                'id': 'float_value',
                'string': 'Float Value',
                'type': 'float',
            }, {
                'id': 'boolean_value',
                'string': 'Boolean Value',
                'type': 'boolean',
            },
        ]

        self.message_1.custom_properties = {
            'int_value': 55555555555,
            'float_value': 1.337,
            'boolean_value': 77777,  # should be converted into True
        }

        self._flush_and_invalidate()

        self.assertEqual(len(self.message_1.custom_properties), 3)
        self.assertEqual(self.message_1.custom_properties[0]['value'], 55555555555)
        self.assertEqual(self.message_1.custom_properties[1]['value'], 1.337)
        self.assertEqual(self.message_1.custom_properties[2]['value'], True)

        self.message_1.custom_properties = {'boolean_value': 0}
        self.assertEqual(
            self.message_1.custom_properties[2]['value'], False,
            msg='Boolean value must have been converted to False')

    def test_properties_field_selection(self):
        self.message_3.custom_properties = {'state': 'done'}
        self._flush_and_invalidate()
        self.assertEqual(self.message_3.custom_properties[0]['value'], 'done')

        # the option might have been removed on the parent, write False
        self.message_3.custom_properties = {'state': 'unknown_selection'}
        self._flush_and_invalidate()
        self.assertFalse(self.message_3.custom_properties[0]['value'])

        with self.assertRaises(ValueError):
            self.discussion_1.message_properties = [
                {
                    'id': 'option',
                    'type': 'selection',
                    'selection': [['a', 'A'], ['b', 'B'], ['a', 'C']],
                }
            ]

    def test_properties_field_tags(self):
        """Test the behavior of the tag property.

        The tags properties is basically the same as the selection property,
        but you can select multiple values. It should work like the selection
        (if we remove a value on the parent, it should remove the value on each
        child the next time we read, etc).

        Each tags has a color index defined on the parent.
        """
        self.discussion_1.message_properties = [
            {
                'id': 'my_tags',
                'string': 'My Tags',
                'type': 'tags',
                'tags': [
                    ('be', 'BE', 1),
                    ('fr', 'FR', 2),
                    ('de', 'DE', 3),
                    ('it', 'IT', 1),
                ],
                'default': ['be', 'de'],
            },
        ]
        message = self.env['test_new_api.message'].create(
            {'discussion': self.discussion_1.id, 'author': self.user.id})

        self.assertEqual(message.custom_properties[0]['value'], ['be', 'de'])
        self.assertEqual(self._get_sql_properties(message), {'my_tags': ['be', 'de']})

        self._flush_and_invalidate()

        # remove the DE tags on the parent
        self.discussion_1.message_properties = [
            {
                'id': 'my_tags',
                'string': 'My Tags',
                'type': 'tags',
                'tags': [
                    ('be', 'BE', 1),
                    ('fr', 'FR', 2),
                    ('it', 'IT', 1),
                ],
                'default': ['be', 'de'],
            },
        ]

        # the value must remain in the database until the next write on the child
        self.assertEqual(self._get_sql_properties(message), {'my_tags': ['be', 'de']})

        self.assertEqual(
            message.custom_properties[0]['value'],
            ['be'],
            msg='The tag has been removed on the parent, should be removed when reading the child')
        self.assertEqual(
            message.custom_properties[0]['tags'],
            [['be', 'BE', 1], ['fr', 'FR', 2], ['it', 'IT', 1]])

        # next write on the child must update the value
        message.custom_properties = message.custom_properties
        self.assertEqual(self._get_sql_properties(message), {'my_tags': ['be']})

        with self.assertRaises(ValueError):
            # it should detect that the tag is duplicated
            self.discussion_1.message_properties = [
                {
                    'id': 'my_tags',
                    'type': 'tags',
                    'tags': [
                        ('be', 'BE', 1),
                        ('be', 'FR', 2),
                    ],
                },
            ]

    @mute_logger('odoo.models.unlink')
    def test_properties_field_many2many_basic(self):
        """Test the basic operation on a many2many properties (read, write...).

        Check also that if we remove some record,
        those are filtered when we read the child.
        """
        partners = self.env['res.partner'].create([
            {'name': f'Partner {i}'}
            for i in range(20)
        ])

        self.discussion_1.message_properties = [{
            'id': 'partner_ids',
            'string': 'Partners',
            'type': 'many2many',
            'model': 'res.partner',
        }]

        self.assertFalse(self.message_1.custom_properties[0]['value'])

        with self.assertQueryCount(5):
            self.message_1.custom_properties = {'partner_ids': [partners[:10].ids, 'res.partner']}
            self.assertEqual(self.message_1.custom_properties[0]['value'], partners[:10].ids)

        partners[:5].unlink()
        with self.assertQueryCount(3):
            self.assertEqual(self.message_1.custom_properties[0]['value'], partners[5:10].ids)

        partners[5].unlink()
        with self.assertQueryCount(5):
            properties = self.message_1.read(['custom_properties'])[0]['custom_properties']
        self.assertEqual(properties[0]['value'], partners[6:10].name_get())

        # need to wait next write to clean data in database
        # a single read won't clean the removed many2many
        self.message_1.custom_properties = self.message_1.read(['custom_properties'])[0]['custom_properties']

        sql_values = self._get_sql_properties(self.message_1)
        self.assertEqual(sql_values, {'partner_ids': [partners[6:10].ids, 'res.partner']})

        # read and disable name_get
        properties = self.message_1.read(['custom_properties'], load=None)[0]['custom_properties']
        self.assertEqual(
            properties[0]['value'],
            partners[6:10].ids,
            msg='Should not return the partners name',
        )

        # Check that duplicated ids are removed
        self.env.flush_all()
        partner_ids = partners[6:10].ids
        partner_ids += partner_ids[2:]
        new_value = json.dumps({"partner_ids": [partner_ids, 'res.partner']})
        self.env.cr.execute(
            """
            UPDATE test_new_api_message
               SET custom_properties = %s
             WHERE id = %s
            """, (new_value, self.message_1.id, ),
        )
        self.env.invalidate_all()

        properties = self.message_1.read(['custom_properties'], load=None)[0]['custom_properties']
        self.assertEqual(
            properties[0]['value'],
            partners[6:10].ids,
            msg='Should removed duplicated ids',
        )

    def test_properties_field_many2many_model_change(self):
        """Check the behavior of the many2many field if we change the model on the parent.

        Even if some records of the new model have the same ids of the old records
        on the old model, we should be able to detect that we change the model on the
        parent, and therefore that those records are not valid anymore.
        """
        # We should have at least 2 records in 2 different models with the same id
        # for this test to be coherent (otherwise the records will be filtered just
        # because they do not exist and not because the point to a different model
        # than the original one)
        message = self.env['test_new_api.message'].browse(1).exists()
        partner = self.env['res.partner'].browse(1).exists()
        self.assertTrue(message and partner)

        messages = message | self.message_1 | self.message_2 | self.message_3

        self.discussion_1.message_properties = [{
            'id': 'messages',
            'model': 'test_new_api.message',
            'type': 'many2many',
        }]
        self.message_1.custom_properties = {'messages': [messages.ids, messages._name]}

        self.env.invalidate_all()
        self.assertEqual(self.message_1.custom_properties[0]['value'], messages.ids)

        # change the model on the parent, but do not change the property id
        self.discussion_1.message_properties = [{
            'id': 'messages',
            'model': 'res.partner',
            'type': 'many2many',
        }]
        sql_definition = self._get_sql_definition(self.discussion_1)
        self.assertEqual(
            sql_definition,
            [{'id': 'messages', 'model': 'res.partner', 'type': 'many2many'}])

        value = self.message_1.custom_properties[0]['value']
        self.assertFalse(value, msg='Should have detected the model change on the parent')

        # old ids are still in the database until we write on the properties
        sql_properties = self._get_sql_properties(self.message_1)
        self.assertEqual(sql_properties, {'messages': [messages.ids, messages._name]})

        # the next time we write on the field, we should clean the old properties values
        self.message_1.custom_properties = self.message_1.custom_properties
        sql_properties = self._get_sql_properties(self.message_1)
        self.assertEqual(sql_properties, {'messages': False})

    def test_properties_field_performance(self):
        with self.assertQueryCount(3):
            self.message_1.custom_properties

        with self.assertQueryCount(1, msg='Must read value from cache'):
            self.message_1.custom_properties

        with self.assertQueryCount(2):
            self.message_1.custom_properties = {'name': 'New name 1'}
            self.message_1.flush_recordset()

    def test_properties_field_change_definition(self):
        """Test the behavior of the field when changing the definition on the parent."""

        message_properties = self.discussion_1.message_properties

        # state field do not exists, write should be ignored
        self.message_1.custom_properties = {'state': 'ready'}
        self._flush_and_invalidate()
        self.assertFalse(self.message_1.custom_properties[0]['value'])

        # add a property on the parent model
        message_properties += [{'id': 'state', 'string': 'State', 'type': 'char'}]
        self.discussion_1.message_properties = message_properties
        self.message_1.custom_properties = {'state': 'ready'}

        self._flush_and_invalidate()

        self.assertEqual(self.message_1.custom_properties[2]['value'], 'ready')

        # remove a property from the parent model
        # the properties on the child should remain, until we write on it
        # when reading, the removed property must be filtered
        self.discussion_1.message_properties = message_properties[:-1]  # remove the state field

        self.assertFalse(self.message_1.custom_properties[0]['value'])

        value = self._get_sql_properties(self.message_1)
        self.assertEqual(value.get('state'), 'ready', msg='The field should be in database')

        self.message_1.custom_properties = {'name': 'Test name'}
        value = self._get_sql_properties(self.message_1)
        self.assertFalse(value.get('state'), msg='After updating an other property, the value must be cleaned')

        # check that we can only set a allowed list of properties type
        with self.assertRaises(ValueError):
            self.discussion_1.message_properties = [{'id': 'state', 'type': 'wrong_type'}]

        # check the property ID unicity
        with self.assertRaises(ValueError):
            self.discussion_1.message_properties = [
                {'id': 'state', 'type': 'char'},
                {'id': 'state', 'type': 'datetime'},
            ]

    def test_properties_field_search(self):
        """Test the search domain on properties field."""
        messages = self.env['test_new_api.message'].search([('custom_properties.name', '=', 'Test')])
        self.assertEqual(messages, self.message_1, "Should be able to search on a properties field")

        self.message_2.custom_properties = {'name': 'TeSt'}

        self._flush_and_invalidate()

        messages = self.env['test_new_api.message'].search([('custom_properties.name', 'ilike', 'test')])
        self.assertEqual(messages, self.message_1 | self.message_2)

        for search in ['name!', 'na!me', '!name', 'name.test']:
            with self.assertRaises(AssertionError):
                self.env['test_new_api.message'].search([(f'custom_properties.{search}', '=', 'Test')])

    def test_properties_field_onchange(self):
        """If we change the parent field, the onchange of the properties field must be triggered."""
        message_form = Form(self.env['test_new_api.message'])

        with self.assertQueryCount(9):
            message_form.discussion = self.discussion_1
            message_form.author = self.user

            self.assertEqual(
                message_form.custom_properties,
                [{
                    'id': 'name',
                    'string': 'Name',
                    'type': 'char',
                    'default': 'Default Name',
                    'value': 'Default Name',
                }, {
                    'id': 'partner_id',
                    'string': 'Partner',
                    'type': 'many2one',
                    'model': 'res.partner',
                    'value': None,
                }],
                msg='Should take the new definition when changing the parent',
            )

            # change the discussion field
            message_form.discussion = self.discussion_2

            properties = message_form.custom_properties

            self.assertEqual(len(properties), 1)
            self.assertEqual(
                properties[0]['id'],
                'state',
                msg='Should take the definition of the new parent',
            )

        with self.assertQueryCount(7):
            message = message_form.save()

        self.assertEqual(
            message.custom_properties[0]['value'],
            'draft',
            msg='Should take the default value',
        )

        # check cached value
        cached_value = self.env.cache.get(message, message._fields['custom_properties'])
        self.assertEqual(cached_value, {'state': 'draft'})

        # change the parent, should invalidate the cache
        with self.assertQueryCount(7):
            message.discussion = self.discussion_1

        with self.assertRaises(CacheMiss, msg='After changing the parent, the cache must be invalidated'):
            self.env.cache.get(message, message._fields['custom_properties'])

        self.discussion_1.message_properties = False
        self.discussion_2.message_properties = [{'id': 'test', 'type': 'char', 'default': 'Default'}]

        # change the message discussion to remove the properties
        # discussion 1 -> discussion 2
        message.discussion = self.discussion_2
        message.custom_properties = {'test': 'Test'}
        onchange_values = message.onchange(
            values={
                'discussion': self.discussion_1.id,
                'custom_properties': [{'id': 'test', 'type': 'char', 'default': 'Default', 'value': 'Test'}],
            },
            field_name=['discussion'],
            field_onchange={'custom_properties': '1'},
        )
        self.assertTrue(
            'custom_properties' in onchange_values['value'],
            msg='Should have detected the parent change')
        self.assertEqual(
            onchange_values['value']['custom_properties'], [],
            msg='Should have reset the properties definition')

        # change the message discussion to add new properties
        # discussion 2 -> discussion 1
        message.discussion = self.discussion_1
        onchange_values = message.onchange(
            values={
                'discussion': self.discussion_2.id,
                'custom_properties': [],
            },
            field_name=['discussion'],
            field_onchange={'custom_properties': '1'},
        )
        self.assertTrue(
            'custom_properties' in onchange_values['value'],
            msg='Should have detected the parent change')
        self.assertEqual(
            onchange_values['value']['custom_properties'],
            [{'id': 'test', 'type': 'char', 'default': 'Default', 'value': 'Default'}],
            msg='Should have reset the properties definition to the discussion 1 definition')

    def test_properties_field_security(self):
        """Check the access right related to the Properties fields.

        A user should not be able to add a model in a many2one / many2many property if
        he doesn't have the access right to this model.
        """
        MultiTag = type(self.env['test_new_api.multi.tag'])

        self.discussion_1.message_properties = [{
            'id': 'test_1',
            'type': 'many2one',
            'model': 'test_new_api.message',
        }, {
            'id': 'test_2',
            'type': 'many2many',
            'model': 'test_new_api.message',
        }]
        self.assertEqual(self.discussion_1.message_properties[0]['model'], 'test_new_api.message')
        self.assertEqual(self.discussion_1.message_properties[1]['model'], 'test_new_api.message')

        def _mocked_check_access_rights(*args, **kwargs):
            raise AccessError('')

        with patch.object(MultiTag, 'check_access_rights', side_effect=_mocked_check_access_rights), \
             self.assertRaises(AccessError, msg='Should not have access to this model'):
            self.discussion_1.message_properties = [{
                'id': 'test',
                'type': 'many2one',
                'model': 'test_new_api.multi.tag',
            }]

        with patch.object(MultiTag, 'check_access_rights', side_effect=_mocked_check_access_rights), \
             self.assertRaises(AccessError, msg='Should not have access to this model'):
            self.discussion_1.message_properties = [{
                'id': 'test',
                'type': 'many2many',
                'model': 'test_new_api.multi.tag',
            }]

    def _get_sql_properties(self, message):
        self.env.flush_all()

        self.env.cr.execute(
            """
            SELECT custom_properties
              FROM test_new_api_message
             WHERE id = %s
            """, (message.id, ),
        )
        value = self.env.cr.fetchall()
        self.assertTrue(value and value[0] and value[0][0])
        return value[0][0]

    def _get_sql_definition(self, discussion):
        self.env.flush_all()

        self.env.cr.execute(
            """
            SELECT message_properties
              FROM test_new_api_discussion
             WHERE id = %s
            """, (discussion.id, ),
        )
        value = self.env.cr.fetchall()
        self.assertTrue(value and value[0] and value[0][0])
        return value[0][0]

    def _flush_and_invalidate(self):
        self.env.flush_all()
        self.env.invalidate_all()

    def _read_property(self, value_list, property_name):
        for property_definition in property_name:
            if property_definition['id'] == property_name:
                return property_definition.get('value')
