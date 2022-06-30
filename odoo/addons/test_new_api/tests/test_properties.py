# -*- coding: utf-8 -*-

from datetime import date, datetime

from odoo import Command, fields
from odoo.exceptions import CacheMiss
from odoo.models import BaseModel
from odoo.tests.common import Form, TransactionCase


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
            'custom_properties': {'name': 'Test', 'partner_id': cls.partner.id},
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

        message_properties = [
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
            'message_properties': message_properties,
            'participants': [Command.link(author.id)],
        })

        self._flush_and_invalidate()

        self.assertTrue(isinstance(discussion.message_properties, list))
        self.assertEqual(discussion.message_properties, message_properties)

        discussion.message_properties = '{"test": 3}'
        self.assertEqual(
            discussion.message_properties, {"test": 3},
            msg='JSON must be parsed when loaded from cache')

        discussion.invalidate_recordset()

        self.assertEqual(discussion.message_properties, {"test": 3})

    def test_properties_field(self):
        message_1, message_2, message_3 = self.message_1, self.message_2, self.message_3
        partner = self.partner

        self._flush_and_invalidate()

        self.assertTrue(isinstance(message_1.custom_properties, fields.PropertiesList))
        self.assertEqual(message_1.custom_properties['name'], 'Test')
        self.assertEqual(
            message_1.custom_properties['partner_id'], partner,
            msg='Should browse the record')
        self.assertEqual(message_2.custom_properties['name'], 'Default Name')
        self.assertFalse(message_2.custom_properties['partner_id'])
        self.assertEqual(
            message_3.custom_properties['state'], 'draft',
            msg='Should have take the default value')

        message_1.custom_properties = {'name': 'New name', 'partner_id': self.partner.id}
        self.assertEqual(message_1.custom_properties['name'], 'New name')

        self._flush_and_invalidate()

        self.assertEqual(message_1.custom_properties['name'], 'New name')
        self.assertEqual(message_1.custom_properties['partner_id'], partner)

        # check that the value has been updated in the database
        value = self._get_sql_properties(message_1)
        self.assertTrue(isinstance(value, dict))
        self.assertEqual(value.get('name'), 'New name', msg='Value must be updated in the database')

        # check that we can not set unknown properties
        message_1.custom_properties = {'unknown_property': 'Test'}
        message_3.custom_properties = {'name': 'Test'}
        self._flush_and_invalidate()
        self.assertFalse(message_1.custom_properties['unknown_property'])
        self.assertFalse(message_3.custom_properties['name'], msg='Name property does not exist for message 3')

        # if we write False on the field, it should still
        # return the properties definition for the web client
        message_3.custom_properties = False
        self._flush_and_invalidate()

        expected = self.discussion_2.message_properties
        for property_definition in expected:
            property_definition['value'] = None

        self.assertEqual(message_3.custom_properties, expected)

    def test_properties_field_write_batch_dict(self):
        """Test the behavior of the write called in batch, with a dict as value."""
        message_1, message_2, message_3 = self.message_1, self.message_2, self.message_3

        # Property "name" only exists for message 1 and 2
        # Property "state" only exists for message 3
        properties_values = {
            'name': 'write name',
            'partner_id': self.partner.id,
            'state': 'done',
        }

        (message_1 | message_3).write({'custom_properties': properties_values})

        self.assertEqual(
            self._get_sql_properties(message_1),
            {'name': 'write name', 'partner_id': self.partner.id})
        self.assertEqual(self._get_sql_properties(message_3), {'state': 'done'})

        self.assertEqual(message_1.custom_properties['name'], 'write name')
        self.assertEqual(message_1.custom_properties['partner_id'], self.partner)

        self.assertEqual(message_2.custom_properties['name'], 'Default Name')
        self.assertFalse(message_2.custom_properties['partner_id'])

        self.assertFalse(message_3.custom_properties['name'])
        self.assertEqual(message_3.custom_properties['state'], 'done')

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
                property_definition['value'] = new_partner

        (self.message_1 | self.message_3).write({'custom_properties': properties_values})

        sql_values_1 = self._get_sql_properties(self.message_1)
        sql_values_3 = self._get_sql_properties(self.message_3)

        self.assertEqual(sql_values_1, {'name': 'write name', 'partner_id': new_partner.id})
        self.assertEqual(sql_values_3, {'state': 'done'})

    def test_properties_field_create_batch(self):
        with self.assertQueryCount(8):
            messages = self.env['test_new_api.message'].create([{
                'name': 'Test Message',
                'discussion': self.discussion_1.id,
                'author': self.user.id,
                'custom_properties': {
                    'name': 'Test',
                    'partner_id': self.partner.id,
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

        self.assertEqual(properties_values_1['name'], 'Test')
        self.assertEqual(properties_values_1['partner_id'], self.partner)
        self.assertEqual(properties_values_2['state'], 'draft', msg='Should have take the default value')

    def test_properties_field_default(self):
        message = self.env['test_new_api.message'].create({
            'name': 'Test Message',
            'discussion': self.discussion_2.id,
            'author': self.user.id,
        })
        self.assertEqual(
            message.custom_properties['state'],
            'draft',
            msg='Should have take the default value')

        message.custom_properties = {'state': None}
        self.assertFalse(
            message.custom_properties['state'],
            msg='Writing None should not reset the default value')

        # test the case where the parent come from a default as well
        self.env['test_new_api.message']._fields['discussion'].default = lambda __: self.discussion_2.id
        message = self.env['test_new_api.message'].create({
            'name': 'Test Message',
            'author': self.user.id,
        })
        self.assertEqual(message.discussion, self.discussion_2)
        self.assertEqual(
            message.custom_properties['state'],
            'draft',
            msg='Should have take the default value')

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

        self.assertTrue(isinstance(properties_message_1, fields.PropertiesList))
        self.assertTrue(isinstance(properties_message_3, fields.PropertiesList))

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
        many2one_value = many2one_property['value']
        self.assertTrue(isinstance(many2one_value, tuple))
        self.assertEqual(many2one_value[0], self.partner.id)
        self.assertEqual(many2one_value[1], self.partner.display_name)

        # in comparison, when getting the field from the record attribute
        # the many2one must be a recordset
        many2one_property = self.message_1.custom_properties['partner_id']
        self.assertTrue(isinstance(many2one_property, BaseModel))

        # disable the name_get
        properties_values = (self.message_1 | self.message_3).read(['custom_properties'], load=None)
        many2one_property = properties_values[0]['custom_properties'][1]

        self.assertEqual(
            many2one_property['value'], self.partner.id,
            msg='If name_get is disable, should only return the record id')

    def test_properties_field_many2one(self):
        # write on the property using a recordset
        self.message_2.custom_properties = {'partner_id': self.partner}
        self.assertEqual(self.message_2.custom_properties['partner_id'], self.partner)
        sql_values = self._get_sql_properties(self.message_2)
        self.assertEqual(sql_values, {'name': None, 'partner_id': self.partner.id})

        # write on the property using a record id
        partner = self.env['res.partner'].create({'name': 'Test Partner'})
        self.message_2.custom_properties = {'partner_id': partner.id}
        self.assertEqual(self.message_2.custom_properties['partner_id'], partner)
        sql_values = self._get_sql_properties(self.message_2)
        self.assertEqual(sql_values, {'name': None, 'partner_id': partner.id})

        # read the many2one
        properties = self.message_2.read(['custom_properties'])[0]['custom_properties']
        self.assertEqual(properties['partner_id'], (partner.id, partner.display_name))

        # remove the partner on message 2
        partner.unlink()
        with self.assertQueryCount(3):
            # 1 request to read the field
            # 1 request to read the parent definition
            # 1 request to check if the many2one still exists
            self.assertFalse(self.message_2.custom_properties['partner_id'])

        # remove the partner, and use the read method
        partner = self.env['res.partner'].create({'name': 'New Partner'})
        self.message_2.custom_properties = {'partner_id': partner.id}
        partner.unlink()
        with self.assertQueryCount(4):
            value = self.message_2.read(['custom_properties'])
            value = value[0]['custom_properties']
            self.assertFalse(value['partner_id'])

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

        self.assertEqual(self.message_1.custom_properties['int_value'], 55555555555)
        self.assertAlmostEqual(self.message_1.custom_properties['float_value'], 1.337)
        self.assertEqual(self.message_1.custom_properties['boolean_value'], True)

        self.message_1.custom_properties = {'boolean_value': 0}
        self.assertEqual(
            self.message_1.custom_properties['boolean_value'], False,
            msg='Boolean value must have been converted to False')

    def test_properties_field_date(self):
        self.discussion_2.message_properties = [{
            'id': 'my_date',
            'string': 'My Date',
            'type': 'date',
        }, {
            'id': 'my_datetime',
            'string': 'My Datetime',
            'type': 'datetime',
        }]

        self.assertFalse(self.message_3.custom_properties['my_date'])
        self.assertFalse(self.message_3.custom_properties['my_datetime'])

        self.message_3.custom_properties = {
            'my_date': date(2022, 1, 3),
            'my_datetime': datetime(2022, 1, 3, 5, 6),
        }

        self._flush_and_invalidate()

        values = self._get_sql_properties(self.message_3)

        # date / datetime must be converted into string
        self.assertEqual(values, {'my_date': '2022-01-03', 'my_datetime': '2022-01-03 05:06:00'})

        my_date = self.message_3.custom_properties['my_date']
        self.assertTrue(
            isinstance(my_date, date),
            msg='Must parse the date when reading from database')
        self.assertEqual(my_date, date(2022, 1, 3))

        my_datetime = self.message_3.custom_properties['my_datetime']
        self.assertTrue(
            isinstance(my_datetime, date),
            msg='Must parse the datetime when reading from database')
        self.assertEqual(my_datetime, datetime(2022, 1, 3, 5, 6))

    def test_properties_field_selection(self):
        self.message_3.custom_properties = {'state': 'done'}
        self._flush_and_invalidate()
        self.assertEqual(self.message_3.custom_properties['state'], 'done')

        # the option might have been removed on the parent, write False
        self.message_3.custom_properties = {'state': 'unknown_selection'}
        self._flush_and_invalidate()
        self.assertFalse(self.message_3.custom_properties['state'])

    def test_properties_field_many2many(self):
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

        self.assertFalse(self.message_1.custom_properties['partner_ids'])

        with self.assertQueryCount(5):
            self.message_1.custom_properties = {'partner_ids': partners[:10]}
            self.assertEqual(self.message_1.custom_properties['partner_ids'], partners[:10])

        partners[:5].unlink()
        with self.assertQueryCount(3):
            self.assertEqual(self.message_1.custom_properties['partner_ids'], partners[5:10])

        partners[5].unlink()
        with self.assertQueryCount(5):
            properties = self.message_1.read(['custom_properties'])[0]['custom_properties']
        self.assertEqual(properties['partner_ids'], partners[6:10].name_get())

        # need to wait next write to clean data in database
        # a single read won't clean the removed many2many
        self.message_1.custom_properties = self.message_1.custom_properties

        sql_values = self._get_sql_properties(self.message_1)
        self.assertEqual(sql_values, {'partner_ids': partners[6:10].ids})

        # read and disable name_get
        properties = self.message_1.read(['custom_properties'], load=None)[0]['custom_properties']
        self.assertEqual(properties['partner_ids'], partners[6:10].ids)

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
        self.assertFalse(self.message_1.custom_properties['state'])

        # add a property on the parent model
        message_properties += [{'id': 'state', 'string': 'State', 'type': 'char'}]
        self.discussion_1.message_properties = message_properties
        self.message_1.custom_properties = {'state': 'ready'}

        self._flush_and_invalidate()

        self.assertEqual(self.message_1.custom_properties['state'], 'ready')

        # remove a property from the parent model
        # the properties on the child should remain, until we write on it
        # when reading, the removed property must be filtered
        self.discussion_1.message_properties = message_properties[:-1]  # remove the state field

        self.assertFalse(self.message_1.custom_properties['state'])

        value = self._get_sql_properties(self.message_1)
        self.assertEqual(value.get('state'), 'ready', msg='The field should be in database')

        self.message_1.custom_properties = {'name': 'Test name'}
        value = self._get_sql_properties(self.message_1)
        self.assertFalse(value.get('state'), msg='After updating an other property, the value must be cleaned')

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
            message_form.custom_properties = [{'id': 'name', 'value': 'Test'}]
            message_form.author = self.user
            self.assertEqual(message_form.custom_properties, [{'id': 'name', 'value': 'Test'}])

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
            message.custom_properties['state'],
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

    def _get_sql_properties(self, message):
        self.env.flush_all()

        self.env.cr.execute(
            """
            SELECT custom_properties
              FROM test_new_api_message
             WHERE id = %s
            """, (message.id,),
        )
        value = self.env.cr.fetchall()
        self.assertTrue(value and value[0] and value[0][0])
        return value[0][0]

    def _flush_and_invalidate(self):
        self.env.flush_all()
        self.env.invalidate_all()
