# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo.exceptions import AccessError, MissingError
from odoo.tests.common import TransactionCase
from odoo.tools import mute_logger, pycompat
from odoo.addons.test_base.tests.common import TransactionCaseCommon


class TestORM(TransactionCaseCommon):
    """ test special behaviors of ORM CRUD functions """

    @mute_logger('odoo.models')
    def test_access_deleted_records(self):
        """ Verify that accessing deleted records works as expected """
        test_base1 = self.env['test.base'].create({'name': 'W'})
        test_base2 = self.env['test.base'].create({'name': 'Y'})
        test_base1.unlink()

        # read() is expected to skip deleted records because our API is not
        # transactional for a sequence of search()->read() performed from the
        # client-side... a concurrent deletion could therefore cause spurious
        # exceptions even when simply opening a list view!
        # /!\ Using unprileged user to detect former side effects of ir.rules!
        test_bases = (test_base1 + test_base2).sudo(self.user_test)
        self.assertEqual([{'id': test_base2.id, 'name': 'Y'}], test_bases.read(['name']), "read() should skip deleted records")
        self.assertEqual([], test_bases[0].read(['name']), "read() should skip deleted records")

        # Deleting an already deleted record should be simply ignored
        self.assertTrue(test_base1.unlink(), "Re-deleting should be a no-op")

        # Updating an already deleted record should raise, even as admin
        with self.assertRaises(MissingError):
            test_base1.write({'name': 'foo'})

    @mute_logger('odoo.models')
    def test_access_filtered_records(self):
        """ Verify that accessing filtered records works as expected for non-admin user """
        test_base1 = self.env['test.base'].create({'name': 'W'})
        test_base2 = self.env['test.base'].create({'name': 'Y'})
        test_base_model = self.env['ir.model'].search([('model','=','test.base')])
        self.env['ir.rule'].create({
            'name': 'Y is invisible',
            'domain_force': [('id', '!=', test_base1.id)],
            'model_id': test_base_model.id,
        })

        # search as unprivileged user
        test_bases = self.env['test.base'].sudo(self.user_test).search([])
        self.assertNotIn(test_base1, test_bases, "W should not be visible...")
        self.assertIn(test_base2, test_bases, "... but Y should be visible")

        # read as unprivileged user
        with self.assertRaises(AccessError):
            test_base1.sudo(self.user_test).read(['name'])
        # write as unprivileged user
        with self.assertRaises(AccessError):
            test_base1.sudo(self.user_test).write({'name': 'foo'})
        # unlink as unprivileged user
        with self.assertRaises(AccessError):
            test_base1.sudo(self.user_test).unlink()

        # Prepare mixed case
        test_base2.unlink()
        # read mixed records: some deleted and some filtered
        with self.assertRaises(AccessError):
            (test_base1 + test_base2).sudo(self.user_test).read(['name'])
        # delete mixed records: some deleted and some filtered
        with self.assertRaises(AccessError):
            (test_base1 + test_base2).sudo(self.user_test).unlink()

    def test_read(self):
        test_base = self.env['test.base'].create({'name': 'Test1'})
        result = test_base.read()
        self.assertIsInstance(result, list)

    @mute_logger('odoo.models')
    def test_search_read(self):
        TestBase = self.env['test.base']

        # simple search_read
        TestBase.create({'name': 'Test1'})
        found = TestBase.search_read([('name', '=', 'Test1')], ['name'])
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]['name'], 'Test1')
        self.assertIn('id', found[0])

        # search_read correct order
        TestBase.create({'name': 'Test2'})
        found = TestBase.search_read([('name', 'like', 'Test')], ['name'], order="name")
        self.assertEqual(len(found), 2)
        self.assertEqual(found[0]['name'], 'Test1')
        self.assertEqual(found[1]['name'], 'Test2')
        found = TestBase.search_read([('name', 'like', 'Test')], ['name'], order="name desc")
        self.assertEqual(len(found), 2)
        self.assertEqual(found[0]['name'], 'Test2')
        self.assertEqual(found[1]['name'], 'Test1')

        # search_read that finds nothing
        found = TestBase.search_read([('name', '=', 'Does not exists')], ['name'])
        self.assertEqual(len(found), 0)

    def test_exists(self):
        TestBase = self.env['test.base']

        # check that records obtained from search exist
        test_bases = TestBase.search([])
        self.assertTrue(test_bases)
        self.assertEqual(test_bases.exists(), test_bases)

        # check that there is no record with id 0
        test_bases = TestBase.browse([0])
        self.assertFalse(test_bases.exists())

    def test_groupby_date(self):
        test_bases_data = dict(
            A='2012-11-19',
            B='2012-12-17',
            C='2012-12-31',
            D='2013-01-07',
            E='2013-01-14',
            F='2013-01-28',
            G='2013-02-11',
        )

        test_base_ids = []
        test_base_ids_by_day = defaultdict(list)
        test_base_ids_by_month = defaultdict(list)
        test_base_ids_by_year = defaultdict(list)

        TestBase = self.env['test.base']
        for name, date in test_bases_data.items():
            test_base = TestBase.create(dict(name=name, date=date))
            test_base_ids.append(test_base.id)
            test_base_ids_by_day[date].append(test_base.id)
            test_base_ids_by_month[date.rsplit('-', 1)[0]].append(test_base.id)
            test_base_ids_by_year[date.split('-', 1)[0]].append(test_base.id)

        def read_group(interval):
            domain = [('id', 'in', test_base_ids)]
            result = {}
            for grp in TestBase.read_group(domain, ['date'], ['date:' + interval]):
                result[grp['date:' + interval]] = TestBase.search(grp['__domain'])
            return result

        self.assertEqual(len(read_group('day')), len(test_base_ids_by_day))
        self.assertEqual(len(read_group('month')), len(test_base_ids_by_month))
        self.assertEqual(len(read_group('year')), len(test_base_ids_by_year))

        test_base = TestBase.read_group([('id', 'in', test_base_ids)], ['date'],
                                  ['date:month', 'date:day'], lazy=False)
        self.assertEqual(len(test_base), len(test_base_ids))

    def test_write_duplicate(self):
        test_base = self.env['test.base'].create({'name': 'W'})
        (test_base + test_base).write({'name': 'X'})

    def test_m2m_store_trigger(self):
        group_user = self.env.ref('base.group_user')
        self.user_test.write({'groups_id': [(6, 0, [])]})
        self.assertTrue(self.user_test.share)

        group_user.write({'users': [(4, self.user_test.id)]})
        self.assertFalse(self.user_test.share)

        group_user.write({'users': [(3, self.user_test.id)]})
        self.assertTrue(self.user_test.share)


class TestInherits(TransactionCase):
    """ test the behavior of the orm for models that use _inherits;
        specifically: res.users, that inherits from res.partner
    """

    def test_default(self):
        """ `default_get` cannot return a dictionary or a new id """
        defaults = self.env['test.many2one'].default_get(['sub_many2one_id'])
        if 'sub_many2one_id' in defaults:
            self.assertIsInstance(defaults['sub_many2one_id'], (bool, pycompat.integer_types))

    def test_create(self):
        """ creating a user should automatically create a new partner """
        test_bases_before = self.env['test.base'].search([])
        o2m_foo = self.env['test.one2many'].create({'name': 'Foo', 'login': 'foo'})

        self.assertNotIn(o2m_foo.test_base_id, test_bases_before)

    def test_create_with_ancestor(self):
        """ creating a user with a specific 'partner_id' should not create a new partner """
        test_base_foo = self.env['test.base'].create({'name': 'Foo'})
        test_bases_before = self.env['test.base'].search([])
        o2m_foo = self.env['test.one2many'].create({'test_base_id': test_base_foo.id, 'login': 'foo'})
        test_bases_after = self.env['test.base'].search([])

        self.assertEqual(test_bases_before, test_bases_after)
        self.assertEqual(o2m_foo.name, 'Foo')
        self.assertEqual(o2m_foo.partner_id, test_base_foo)

    @mute_logger('odoo.models')
    def test_read(self):
        """ inherited fields should be read without any indirection """
        user_foo = self.env['res.users'].create({'name': 'Foo', 'login': 'foo'})
        user_values, = user_foo.read()
        partner_values, = user_foo.partner_id.read()

        self.assertEqual(user_values['name'], partner_values['name'])
        self.assertEqual(user_foo.name, user_foo.partner_id.name)

    @mute_logger('odoo.models')
    def test_copy(self):
        """ copying a user should automatically copy its partner, too """
        user_foo = self.env['res.users'].create({
            'name': 'Foo',
            'login': 'foo',
            'supplier': True,
        })
        foo_before, = user_foo.read()
        del foo_before['__last_update']
        user_bar = user_foo.copy({'login': 'bar'})
        foo_after, = user_foo.read()
        del foo_after['__last_update']

        self.assertEqual(foo_before, foo_after)

        self.assertEqual(user_bar.name, 'Foo (copy)')
        self.assertEqual(user_bar.login, 'bar')
        self.assertEqual(user_foo.supplier, user_bar.supplier)
        self.assertNotEqual(user_foo.id, user_bar.id)
        self.assertNotEqual(user_foo.partner_id.id, user_bar.partner_id.id)

    @mute_logger('odoo.models')
    def test_copy_with_ancestor(self):
        """ copying a user with 'parent_id' in defaults should not duplicate the partner """
        user_foo = self.env['res.users'].create({'name': 'Foo', 'login': 'foo', 'password': 'foo',
                                                 'login_date': '2016-01-01', 'signature': 'XXX'})
        partner_bar = self.env['res.partner'].create({'name': 'Bar'})

        foo_before, = user_foo.read()
        del foo_before['__last_update']
        del foo_before['login_date']
        partners_before = self.env['res.partner'].search([])
        user_bar = user_foo.copy({'partner_id': partner_bar.id, 'login': 'bar'})
        foo_after, = user_foo.read()
        del foo_after['__last_update']
        del foo_after['login_date']
        partners_after = self.env['res.partner'].search([])

        self.assertEqual(foo_before, foo_after)
        self.assertEqual(partners_before, partners_after)

        self.assertNotEqual(user_foo.id, user_bar.id)
        self.assertEqual(user_bar.partner_id.id, partner_bar.id)
        self.assertEqual(user_bar.login, 'bar', "login is given from copy parameters")
        self.assertFalse(user_bar.password, "password should not be copied from original record")
        self.assertEqual(user_bar.name, 'Bar', "name is given from specific partner")
        self.assertEqual(user_bar.signature, user_foo.signature, "signature should be copied")


CREATE = lambda values: (0, False, values)
UPDATE = lambda id, values: (1, id, values)
DELETE = lambda id: (2, id, False)
FORGET = lambda id: (3, id, False)
LINK_TO = lambda id: (4, id, False)
DELETE_ALL = lambda: (5, False, False)
REPLACE_WITH = lambda ids: (6, False, ids)


class TestO2MSerialization(TransactionCase):
    """ test the orm method 'write' on one2many fields """

    def setUp(self):
        super(TestO2MSerialization, self).setUp()
        self.partner = self.registry('res.partner')

    def test_no_command(self):
        " empty list of commands yields an empty list of records "
        results = self.env['res.partner'].resolve_2many_commands('child_ids', [])
        self.assertEqual(results, [])

    def test_CREATE_commands(self):
        " returns the VALUES dict as-is "
        values = [{'foo': 'bar'}, {'foo': 'baz'}, {'foo': 'baq'}]
        results = self.env['res.partner'].resolve_2many_commands('child_ids', [CREATE(v) for v in values])
        self.assertEqual(results, values)

    def test_LINK_TO_command(self):
        " reads the records from the database, records are returned with their ids. "
        ids = [
            self.env['res.partner'].create({'name': 'foo'}).id,
            self.env['res.partner'].create({'name': 'bar'}).id,
            self.env['res.partner'].create({'name': 'baz'}).id,
        ]
        commands = [LINK_TO(v) for v in ids]

        results = self.env['res.partner'].resolve_2many_commands('child_ids', commands, ['name'])
        self.assertItemsEqual(results, [
            {'id': ids[0], 'name': 'foo'},
            {'id': ids[1], 'name': 'bar'},
            {'id': ids[2], 'name': 'baz'},
        ])

    def test_bare_ids_command(self):
        " same as the equivalent LINK_TO commands "
        ids = [
            self.env['res.partner'].create({'name': 'foo'}).id,
            self.env['res.partner'].create({'name': 'bar'}).id,
            self.env['res.partner'].create({'name': 'baz'}).id,
        ]

        results = self.env['res.partner'].resolve_2many_commands('child_ids', ids, ['name'])
        self.assertItemsEqual(results, [
            {'id': ids[0], 'name': 'foo'},
            {'id': ids[1], 'name': 'bar'},
            {'id': ids[2], 'name': 'baz'},
        ])

    def test_UPDATE_command(self):
        " take the in-db records and merge the provided information in "
        foo = self.env['res.partner'].create({'name': 'foo'})
        bar = self.env['res.partner'].create({'name': 'bar'})
        baz = self.env['res.partner'].create({'name': 'baz', 'city': 'tag'})
        commands = [
            LINK_TO(foo.id),
            UPDATE(bar.id, {'name': 'qux', 'city': 'tagtag'}),
            UPDATE(baz.id, {'name': 'quux'}),
        ]

        results = self.env['res.partner'].resolve_2many_commands('child_ids', commands, ['name', 'city'])
        self.assertItemsEqual(results, [
            {'id': foo.id, 'name': 'foo', 'city': False},
            {'id': bar.id, 'name': 'qux', 'city': 'tagtag'},
            {'id': baz.id, 'name': 'quux', 'city': 'tag'},
        ])

    def test_DELETE_command(self):
        " deleted records are not returned at all. "
        ids = [
            self.env['res.partner'].create({'name': 'foo'}).id,
            self.env['res.partner'].create({'name': 'bar'}).id,
            self.env['res.partner'].create({'name': 'baz'}).id,
        ]
        commands = [DELETE(v) for v in ids]

        results = self.env['res.partner'].resolve_2many_commands('child_ids', commands, ['name'])
        self.assertEqual(results, [])

    def test_mixed_commands(self):
        ids = [
            self.env['res.partner'].create({'name': name}).id
            for name in ['NObar', 'baz', 'qux', 'NOquux', 'NOcorge', 'garply']
        ]
        commands = [
            CREATE({'name': 'foo'}),
            UPDATE(ids[0], {'name': 'bar'}),
            LINK_TO(ids[1]),
            DELETE(ids[2]),
            UPDATE(ids[3], {'name': 'quux',}),
            UPDATE(ids[4], {'name': 'corge'}),
            CREATE({'name': 'grault'}),
            LINK_TO(ids[5]),
        ]

        results = self.env['res.partner'].resolve_2many_commands('child_ids', commands, ['name'])
        self.assertItemsEqual(results, [
            {'name': 'foo'},
            {'id': ids[0], 'name': 'bar'},
            {'id': ids[1], 'name': 'baz'},
            {'id': ids[3], 'name': 'quux'},
            {'id': ids[4], 'name': 'corge'},
            {'name': 'grault'},
            {'id': ids[5], 'name': 'garply'},
        ])

    def test_LINK_TO_pairs(self):
        "LINK_TO commands can be written as pairs, instead of triplets"
        ids = [
            self.env['res.partner'].create({'name': 'foo'}).id,
            self.env['res.partner'].create({'name': 'bar'}).id,
            self.env['res.partner'].create({'name': 'baz'}).id,
        ]
        commands = [(4, id) for id in ids]

        results = self.env['res.partner'].resolve_2many_commands('child_ids', commands, ['name'])
        self.assertItemsEqual(results, [
            {'id': ids[0], 'name': 'foo'},
            {'id': ids[1], 'name': 'bar'},
            {'id': ids[2], 'name': 'baz'},
        ])

    def test_singleton_commands(self):
        "DELETE_ALL can appear as a singleton"
        commands = [DELETE_ALL()]
        results = self.env['res.partner'].resolve_2many_commands('child_ids', commands, ['name'])
        self.assertEqual(results, [])
