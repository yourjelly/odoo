# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import ast
import unittest

from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase, tagged
from odoo.tools import mute_logger
from odoo.tools.safe_eval import safe_eval, const_eval


@tagged('standard', 'at_install')
class TestSafeEval(unittest.TestCase):
    def test_const(self):
        # NB: True and False are names in Python 2 not consts
        expected = (1, {"a": {2.5}}, [None, u"foo"])
        actual = const_eval('(1, {"a": {2.5}}, [None, u"foo"])')
        self.assertEqual(actual, expected)

    def test_01_safe_eval(self):
        """ Try a few common expressions to verify they work with safe_eval """
        expected = (1, {"a": 9 * 2}, (True, False, None))
        actual = safe_eval('(1, {"a": 9 * 2}, (True, False, None))')
        self.assertEqual(actual, expected, "Simple python expressions are not working with safe_eval")

    def test_02_literal_eval(self):
        """ Try simple literal definition to verify it works with literal_eval """
        expected = (1, {"a": 9}, (True, False, None))
        actual = ast.literal_eval('(1, {"a": 9}, (True, False, None))')
        self.assertEqual(actual, expected, "Simple python expressions are not working with literal_eval")

    def test_03_literal_eval_arithmetic(self):
        """ Try arithmetic expression in literal_eval to verify it does not work """
        with self.assertRaises(ValueError):
           ast.literal_eval('(1, {"a": 2*9}, (True, False, None))')

    def test_04_literal_eval_forbidden(self):
        """ Try forbidden expressions in literal_eval to verify they are not allowed """
        with self.assertRaises(ValueError):
           ast.literal_eval('{"a": True.__class__}')

    @mute_logger('odoo.tools.safe_eval')
    def test_05_safe_eval_forbiddon(self):
        """ Try forbidden expressions in safe_eval to verify they are not allowed (open) """
        with self.assertRaises(ValueError):
            safe_eval('open("/etc/passwd","r")')


# samples use effective TLDs from the Mozilla public suffix
# list at http://publicsuffix.org
SAMPLES = [
    ('"Raoul Grosbedon" <raoul@chirurgiens-dentistes.fr> ', 'Raoul Grosbedon', 'raoul@chirurgiens-dentistes.fr'),
    ('ryu+giga-Sushi@aizubange.fukushima.jp', '', 'ryu+giga-Sushi@aizubange.fukushima.jp'),
    ('Raoul chirurgiens-dentistes.fr', 'Raoul chirurgiens-dentistes.fr', ''),
    (" Raoul O'hara  <!@historicalsociety.museum>", "Raoul O'hara", '!@historicalsociety.museum'),
]

class TestBase(TransactionCase):

    def test_00_res_partner_name_create(self):
        res_partner = self.env['res.partner']
        parse = res_partner._parse_partner_name
        for text, name, mail in SAMPLES:
            self.assertEqual((name, mail), parse(text), 'Partner name parsing failed')
            partner_id, dummy = res_partner.name_create(text)
            partner = res_partner.browse(partner_id)
            self.assertEqual(name or mail, partner.name, 'Partner name incorrect')
            self.assertEqual(mail or False, partner.email, 'Partner email incorrect')

    def test_10_res_partner_find_or_create(self):
        res_partner = self.env['res.partner']
        email = SAMPLES[0][0]
        partner_id, dummy = res_partner.name_create(email)
        found_id = res_partner.find_or_create(email)
        self.assertEqual(partner_id, found_id, 'find_or_create failed')
        partner_id2, dummy2 = res_partner.name_create('sarah.john@connor.com')
        found_id2 = res_partner.find_or_create('john@connor.com')
        self.assertNotEqual(partner_id2, found_id2, 'john@connor.com match sarah.john@connor.com')
        new_id = res_partner.find_or_create(SAMPLES[1][0])
        self.assertTrue(new_id > partner_id, 'find_or_create failed - should have created new one')
        new_id2 = res_partner.find_or_create(SAMPLES[2][0])
        self.assertTrue(new_id2 > new_id, 'find_or_create failed - should have created new one again')

    def test_20_res_partner_address_sync(self):
        res_partner = self.env['res.partner']
        ghoststep = res_partner.create({
            'name': 'GhostStep',
            'is_company': True,
            'street': 'Main Street, 10',
            'phone': '123456789',
            'email': 'info@ghoststep.com',
            'vat': 'BE0477472701',
            'type': 'contact',
        })
        p1 = res_partner.browse(res_partner.name_create('Denis Bladesmith <denis.bladesmith@ghoststep.com>')[0])
        self.assertEqual(p1.type, 'contact', 'Default type must be "contact"')
        p1phone = '123456789#34'
        p1.write({'phone': p1phone,
                  'parent_id': ghoststep.id})
        self.assertEqual(p1.street, ghoststep.street, 'Address fields must be synced')
        self.assertEqual(p1.phone, p1phone, 'Phone should be preserved after address sync')
        self.assertEqual(p1.type, 'contact', 'Type should be preserved after address sync')
        self.assertEqual(p1.email, 'denis.bladesmith@ghoststep.com', 'Email should be preserved after sync')

        # turn off sync
        # p1street = 'Different street, 42'
        # p1.write({'street': p1street,
        #           'type': 'invoice'})
        # self.assertEqual(p1.street, p1street, 'Address fields must not be synced after turning sync off')
        # self.assertNotEqual(ghoststep.street, p1street, 'Parent address must never be touched')

        # turn on sync again
        p1.write({'type': 'contact'})
        self.assertEqual(p1.street, ghoststep.street, 'Address fields must be synced again')
        self.assertEqual(p1.phone, p1phone, 'Phone should be preserved after address sync')
        self.assertEqual(p1.type, 'contact', 'Type should be preserved after address sync')
        self.assertEqual(p1.email, 'denis.bladesmith@ghoststep.com', 'Email should be preserved after sync')

        # Modify parent, sync to children
        ghoststreet = 'South Street, 25'
        ghoststep.write({'street': ghoststreet})
        self.assertEqual(p1.street, ghoststreet, 'Address fields must be synced automatically')
        self.assertEqual(p1.phone, p1phone, 'Phone should not be synced')
        self.assertEqual(p1.email, 'denis.bladesmith@ghoststep.com', 'Email should be preserved after sync')

        p1street = 'My Street, 11'
        p1.write({'street': p1street})
        self.assertEqual(ghoststep.street, ghoststreet, 'Touching contact should never alter parent')

    def test_30_res_partner_first_contact_sync(self):
        """ Test initial creation of company/contact pair where contact address gets copied to
        company """
        res_partner = self.env['res.partner']
        ironshield = res_partner.browse(res_partner.name_create('IronShield')[0])
        self.assertFalse(ironshield.is_company, 'Partners are not companies by default')
        self.assertEqual(ironshield.type, 'contact', 'Default type must be "contact"')
        ironshield.write({'type': 'contact'})

        p1 = res_partner.create({
            'name': 'Isen Hardearth',
            'street': 'Strongarm Avenue, 12',
            'parent_id': ironshield.id,
        })
        self.assertEquals(p1.type, 'contact', 'Default type must be "contact", not the copied parent type')
        self.assertEqual(ironshield.street, p1.street, 'Address fields should be copied to company')

    def test_70_archive_internal_partners(self):
        test_partner = self.env['res.partner'].create({'name':'test partner'})
        test_user = self.env['res.users'].create({
                                'login': 'test@odoo.com',
                                'partner_id': test_partner.id,
                                })
        # Cannot archive the partner
        with self.assertRaises(ValidationError):
            test_partner.toggle_active()

        # Can archive the user but the partner stays active
        test_user.toggle_active()
        self.assertTrue(test_partner.active, 'Parter related to user should remain active')

        # Now we can archive the partner
        test_partner.toggle_active()

        # Activate the user should reactivate the partner
        test_user.toggle_active()
        self.assertTrue(test_partner.active, 'Activating user must active related partner')


class TestPartnerRecursion(TransactionCase):

    def setUp(self):
        super(TestPartnerRecursion,self).setUp()
        res_partner = self.env['res.partner']
        self.p1 = res_partner.browse(res_partner.name_create('Elmtree')[0])
        self.p2 = res_partner.create({'name': 'Elmtree Child 1', 'parent_id': self.p1.id})
        self.p3 = res_partner.create({'name': 'Elmtree Grand-Child 1.1', 'parent_id': self.p2.id})

    def test_100_res_partner_recursion(self):
        self.assertTrue(self.p3._check_recursion())
        self.assertTrue((self.p1 + self.p2 + self.p3)._check_recursion())

    # split 101, 102, 103 tests to force SQL rollback between them

    def test_101_res_partner_recursion(self):
        with self.assertRaises(ValidationError):
            self.p1.write({'parent_id': self.p3.id})

    def test_102_res_partner_recursion(self):
        with self.assertRaises(ValidationError):
            self.p2.write({'parent_id': self.p3.id})

    def test_103_res_partner_recursion(self):
        with self.assertRaises(ValidationError):
            self.p3.write({'parent_id': self.p3.id})

    def test_104_res_partner_recursion_indirect_cycle(self):
        """ Indirect hacky write to create cycle in children """
        p3b = self.p1.create({'name': 'Elmtree Grand-Child 1.2', 'parent_id': self.p2.id})
        with self.assertRaises(ValidationError):
            self.p2.write({'child_ids': [(1, self.p3.id, {'parent_id': p3b.id}),
                                         (1, p3b.id, {'parent_id': self.p3.id})]})

    def test_110_res_partner_recursion_multi_update(self):
        """ multi-write on several partners in same hierarchy must not trigger a false cycle detection """
        ps = self.p1 + self.p2 + self.p3
        self.assertTrue(ps.write({'phone': '123456'}))

class TestGroups(TransactionCase):

    def test_res_groups_fullname_search(self):
        all_groups = self.env['res.groups'].search([])

        groups = all_groups.search([('full_name', 'like', '%Sale%')])
        self.assertItemsEqual(groups.ids, [g.id for g in all_groups if 'Sale' in g.full_name],
                              "did not match search for 'Sale'")

        groups = all_groups.search([('full_name', 'like', '%Technical%')])
        self.assertItemsEqual(groups.ids, [g.id for g in all_groups if 'Technical' in g.full_name],
                              "did not match search for 'Technical'")

        groups = all_groups.search([('full_name', 'like', '%Sales /%')])
        self.assertItemsEqual(groups.ids, [g.id for g in all_groups if 'Sales /' in g.full_name],
                              "did not match search for 'Sales /'")

        groups = all_groups.search([('full_name', 'in', ['Administration / Access Rights','Contact Creation'])])
        self.assertTrue(groups, "did not match search for 'Administration / Access Rights' and 'Contact Creation'")

    def test_res_group_recursion(self):
        # four groups with no cycle, check them all together
        a = self.env['res.groups'].create({'name': 'A'})
        b = self.env['res.groups'].create({'name': 'B'})
        c = self.env['res.groups'].create({'name': 'G', 'implied_ids': [(6, 0, (a + b).ids)]})
        d = self.env['res.groups'].create({'name': 'D', 'implied_ids': [(6, 0, c.ids)]})
        self.assertTrue((a + b + c + d)._check_m2m_recursion('implied_ids'))

        # create a cycle and check
        a.implied_ids = d
        self.assertFalse(a._check_m2m_recursion('implied_ids'))

    def test_res_group_copy(self):
        a = self.env['res.groups'].with_context(lang='en_US').create({'name': 'A'})
        b = a.copy()
        self.assertFalse(a.name == b.name)
