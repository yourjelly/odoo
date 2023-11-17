# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo.domain import Domain
from odoo.osv.expression import FALSE_LEAF, TRUE_LEAF, prettify_domain, normalize_domain
from odoo.tests.common import TransactionCase



class TestDomain(TransactionCase):

    def test_simple_domain(self):
        Model = self.env['res.partner']
        domains = (
            [('name', 'ilike', 'test')],
            ['&', ('name', 'ilike', 'test'), ('parent_id', '=', -1)],
            ['|', ('name', 'ilike', 'test'), ('parent_id', '=', -1)],
            ['|', '|', ('name', 'ilike', 'test'), ('parent_id', '=', -1), ('id', '!=', 5)],
            ['&', '|', ('name', 'ilike', 'test'), ('parent_id', '=', -1), ('id', '!=', 5)],
            ['&', ('name', 'ilike', 'test'), '|', ('parent_id', '=', -1), ('id', '!=', 5)],
            ['|', '&', ('name', 'ilike', 'test'), ('parent_id', '=', -1), ('id', '!=', 5)],
            ['|', ('name', 'ilike', 'test'), '&', ('parent_id', '=', -1), ('id', '!=', 5)],
            ['|', ('name', 'ilike', 'test'), ('parent_id', '=', -1), ('id', '!=', 5)],

            # '!' operator
            ['!', ('name', 'ilike', 'test')],
            ['!', '&', ('name', 'ilike', 'test'), ('parent_id', '=', -1)],
            ['!', '|', ('name', 'ilike', 'test'), ('parent_id', '=', -1)],
            ['!', ('name', 'ilike', 'test'), ('parent_id', '=', -1)],
        )

        for domain in domains:
            dom_obj = Domain(domain, Model)
            self.assertEqual(dom_obj.as_domain_list(), normalize_domain(domain))

    def test_distribute_not(self):
        Model = self.env['res.partner']

        dom_obj = Domain(['!', ('name', '=', 'test')], Model)
        self.assertEqual(dom_obj.as_domain_list(), [('name', '!=', 'test')])

        dom_obj = Domain(['!', '!', ('name', '=', 'test')], Model)
        self.assertEqual(dom_obj.as_domain_list(), [('name', '!=', 'test')])

        dom_obj = Domain(['!', '&', ('name', '=', 'test'), ('parent_id', '=', -1)], Model)
        self.assertEqual(dom_obj.as_domain_list(), ['|', ('name', '!=', 'test'), ('parent_id', '!=', -1)])

        dom_obj = Domain(['!', '|', ('name', '=', 'test'), ('parent_id', '=', -1)], Model)
        self.assertEqual(dom_obj.as_domain_list(), ['&', ('name', '!=', 'test'), ('parent_id', '!=', -1)])

        dom_obj = Domain(['!', '&', ('name', '=', 'test'), ('parent_id', '%like', -1)], Model)
        self.assertEqual(dom_obj.as_domain_list(), ['|', ('name', '!=', 'test'), '!', ('parent_id', '%like', -1)])

    def test_remove_double_negation(self):
        # Cannot distribute not  `%like`
        Model = self.env['res.partner']
        dom_obj = Domain(['!', ('name', '%like', 'test')], Model)
        self.assertEqual(dom_obj.as_domain_list(), ['!', ('name', '%like', 'test')])

        dom_obj = Domain(['!', '!', ('name', '%like', 'test')], Model)
        self.assertEqual(dom_obj.as_domain_list(), [('name', '%like', 'test')])

        dom_obj = Domain(['!', '!', '!', ('name', '%like', 'test')], Model)
        self.assertEqual(dom_obj.as_domain_list(), ['!', ('name', '%like', 'test')])

        dom_obj = Domain(['!', '!', '!', '!', ('name', '%like', 'test')], Model)
        self.assertEqual(dom_obj.as_domain_list(), [('name', '%like', 'test')])

    def test_remove_true_leaves(self):
        Model = self.env['res.partner']

        dom_obj = Domain([TRUE_LEAF], Model)
        self.assertEqual(dom_obj.as_domain_list(), [])

        dom_obj = Domain([FALSE_LEAF], Model)
        self.assertEqual(dom_obj.as_domain_list(), [FALSE_LEAF])
        self.assertTrue(dom_obj.is_always_false())

    def test_remove_false_leaves(self):
        pass
