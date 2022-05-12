# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from itertools import combinations
from odoo.osv.expression import invert_domain
from odoo.tests.common import TransactionCase


###############################################################################
# Common base class implementing search and filtered_domain checks            #
###############################################################################


class SearchCase(TransactionCase):
    def search(self, domain):
        return self.parent_model.search([
            ('id', 'in', self.parents.ids),
        ] + domain)

    def filter(self, domain):
        return self.parent_model.search([
            ('id', 'in', self.parents.ids),
        ]).filtered_domain(domain)

    def check_consistency(self, expected, searched, filtered, domain):
        tests = {
            'expected': True,
            'searched': all(a == b for a, b in zip(filtered, searched)),
            'filtered': all(a == b for a, b in zip(searched, filtered)),
        }

        right = ' and '.join([key for key, value in tests.items() if value])
        message = 'The {wrong} results are inconsistent with the {right} results for domain {domain}'

        self.assertEqual(searched, filtered, message.format(wrong='searched', right=right, domain=domain))
        self.assertEqual(filtered, searched, message.format(wrong='filtered', right=right, domain=domain))

    def execute_test(self, domain, expected):
        inverted_domain = invert_domain(domain)

        searched = self.search(domain)
        filtered = self.filter(domain)
        self.check_consistency(expected, searched, filtered, domain)

        expected = self.parents - expected
        searched = self.search(inverted_domain)
        filtered = self.filter(inverted_domain)
        self.check_consistency(expected, searched, filtered, inverted_domain)


###############################################################################
# Abstract bases with test definitions                                        #
###############################################################################


def setup_create(case, params, counts):
    return {
        case.parent_field: [(0, 0, {
            **case.get_child_values(param, i),
            case.child_field: param,
        }) for index, param in enumerate(params) for i in range(0, counts[index])],
    }


class TestOne2ManyBase:
    @classmethod
    def prepare_data(cls, n):
        cls.combinations = list(combinations(range(0, n), 2))
        cls.path = f'{cls.parent_field}'
        cls.children = cls.parent_model[cls.parent_field].create([{
            **cls.get_child_values(i, j),
        } for [j, i] in cls.combinations])
        cls.parents = cls.parent_model.create([
            cls.get_parent_values({cls.parent_field: [(6, 0, [
                cls.children[k].id
                for (k, [j, x]) in enumerate(cls.combinations) if x == i
            ])]}, i) for i in range(0, n)
        ])

    @classmethod
    def get_child_values(cls, count, index):
        child_name = cls.parent_model[cls.parent_field]._name.split('.')[-1]
        return {'name': f'parent-{count}-{child_name}-{index}'}

    @classmethod
    def get_parent_values(cls, values, count):
        parent_name = cls.parent_model._name.split('.')[-1]
        return {'name': f'{parent_name}-{count}', **values}

    @classmethod
    def get_children(cls, count=None, index=None):
        return cls.parent_model[cls.parent_field].browse([
            cls.children[k].id
            for (k, [j, i]) in enumerate(cls.combinations)
            if (count == i or count is None) and (index == j or index is None)
        ])

    def test_00_equals(self):
        subdomain = [('id', '=', self.get_children(count=1, index=0).id)]
        domain = [(self.path, 'any', subdomain)]
        self.execute_test(domain, self.parents[1])

    def test_01_not_equals(self):
        subdomain = [('id', '!=', self.get_children(count=1, index=0).id)]
        domain = [(self.path, 'any', subdomain)]
        self.execute_test(domain, self.parents[2])

        subdomain = [('id', '!=', self.get_children(count=2, index=0).id)]
        domain = [(self.path, 'any', subdomain)]
        self.execute_test(domain, self.parents[1:3])

    def test_02_equals_false(self):
        domain = [(self.path, 'any', [('id', '=', False)])]
        self.execute_test(domain, self.parent_model)

    def test_03_not_equals_false(self):
        domain = [(self.path, 'any', [('id', '!=', False)])]
        self.execute_test(domain, self.parents[1:3])

        domain = [(self.path, '!=', False)]
        self.execute_test(domain, self.parents[1:3])

    def test_04_all_equals_false(self):
        domain = [(self.path, 'all', [('id', '=', False)])]
        self.execute_test(domain, self.parents[0])

        domain = [(self.path, '=', False)]
        self.execute_test(domain, self.parents[0])

    def test_05_all_not_equals_false(self):
        domain = [(self.path, 'all', [('id', '!=', False)])]
        self.execute_test(domain, self.parents)


class TestMany2ManyBase:
    @classmethod
    def prepare_data(cls, n):
        cls.path = f'{cls.parent_field}'
        cls.children = cls.parent_model[cls.parent_field].create([{
            **cls.get_child_values(i),
        } for i in range(0, n)])
        cls.parents = cls.parent_model.create([
            cls.get_parent_values({cls.parent_field: [(6, 0, [
                cls.children[j].id
                for j in range(0, n) if (1 << j) & i
            ])]}, i) for i in range(0, 2**n)
        ])

    @classmethod
    def get_child_values(cls, index):
        child_name = cls.parent_model[cls.parent_field]._name.split('.')[-1]
        return {'name': f'{child_name}-child-{index}'}

    @classmethod
    def get_parent_values(cls, values, index):
        parent_name = cls.parent_model._name.split('.')[-1]
        return {'name': f'{parent_name}-parent-{index}', **values}

    @classmethod
    def get_parents(cls, children=None):
        def test_parent(parent):
            return all(c.id in parent[cls.parent_field].ids for c in children)
        children = children or cls.parent_model[cls.parent_field]
        return cls.parents.filtered(test_parent)

    def test_00_equals(self):
        domain = [(self.path, 'any', [('id', '=', self.children[0].id)])]
        self.execute_test(domain, self.get_parents(self.children[0]))

    def test_01_not_equals(self):
        domain = [(self.path, 'any', [('id', '!=', self.children[0].id)])]
        result = self.get_parents(self.children[1]) + self.get_parents(self.children[2])
        self.execute_test(domain, result)

    def test_02_equals_false(self):
        domain = [(self.path, 'any', [('id', '=', False)])]
        self.execute_test(domain, self.parent_model)

    def test_03_not_equals_false(self):
        domain = [(self.path, 'any', [('id', '!=', False)])]
        self.execute_test(domain, self.parents[1:8])

        domain = [(self.path, '!=', False)]
        self.execute_test(domain, self.parents[0])

    def test_04_all_equals_false(self):
        domain = [(self.path, 'all', [('id', '=', False)])]
        self.execute_test(domain, self.parents[0])

        domain = [(self.path, '=', False)]
        self.execute_test(domain, self.parents[0])

    def test_05_all_not_equals_false(self):
        domain = [(self.path, 'all', [('id', '!=', False)])]
        self.execute_test(domain, self.parents)

    def test_06_in(self):
        subdomain = [('id', 'in', self.children[1:3].ids)]
        domain = [(self.path, 'any', subdomain)]
        result = self.get_parents(self.children[1]) + self.get_parents(self.children[2])
        self.execute_test(domain, result)

    def test_07_not_in(self):
        subdomain = [('id', 'not in', self.children[1:3].ids)]
        domain = [(self.path, 'any', subdomain)]
        self.execute_test(domain, self.get_parents(self.children[0]))


class TestSubfield:
    @classmethod
    def prepare_data(cls, params):
        cls.params = params
        cls.path = f'{cls.parent_field}.{cls.child_field}'
        cls.parents = cls.parent_model.create([
            cls.get_parent_values(setup_create(cls, params, [i, j]), params, [i, j])
            for i in range(0, 3) for j in range(0, 3 - i)
        ])

    @classmethod
    def get_parent_values(cls, values, params, counts):
        name = cls.parent_model._name.split('.')[-1]
        return {
            'name': name + ''.join(str(count) for count in counts),
            **values,
        }

    @classmethod
    def get_parents(cls, n=None, m=None):
        return cls.parents.browse([
            cls.parents[(7 - i) * i // 2 + j].id
            for i in range(0, 3) for j in range(0, 3 - i)
            if (i == n or n is None) and (j == m or m is None)
        ])

    def test_00_equals_false(self):
        subdomain = [(self.child_field, '=', False)]
        domain = [(self.parent_field, 'any', subdomain)]
        self.execute_test(domain, self.parent_model)

    def test_01_not_equals_false(self):
        subdomain = [(self.child_field, '!=', False)]
        domain = [(self.parent_field, 'any', subdomain)]
        result = self.parents - self.get_parents(n=0, m=0)
        self.execute_test(domain, result)

    def test_02_equals(self):
        subdomain = [(self.child_field, '=', self.params[0])]
        domain = [(self.parent_field, 'any', subdomain)]
        self.execute_test(domain, self.parents - self.get_parents(n=0))

    def test_03_not_equals(self):
        subdomain = [(self.child_field, '!=', self.params[0])]
        domain = [(self.parent_field, 'any', subdomain)]
        self.execute_test(domain, self.parents - self.get_parents(m=0))

    def test_04_all_equals(self):
        subdomain = [(self.child_field, '=', self.params[0])]
        domain = [(self.parent_field, 'all', subdomain)]
        self.execute_test(domain, self.get_parents(m=0))

    def test_05_all_not_equals(self):
        subdomain = [(self.child_field, '!=', self.params[0])]
        domain = [(self.parent_field, 'all', subdomain)]
        self.execute_test(domain, self.get_parents(n=0))


###############################################################################
# Test classes                                                                #
###############################################################################


class TestOne2Many(SearchCase, TestOne2ManyBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.parent_model = cls.env['res.partner']
        cls.parent_field = 'child_ids'
        cls.prepare_data(3)


class TestMany2Many(SearchCase, TestMany2ManyBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.parent_model = cls.env['res.partner.category']
        cls.parent_field = 'partner_ids'
        cls.prepare_data(3)


class TestOne2ManySubfield(SearchCase, TestSubfield):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.parent_model = cls.env['res.partner']
        cls.parent_field = 'child_ids'
        cls.child_field = 'type'
        cls.prepare_data(['invoice', 'delivery'])

    @classmethod
    def get_child_values(cls, param, count):
        return {'name': 'Child partner'}


class TestOne2ManySubfieldWithAutojoin(SearchCase, TestSubfield):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.parent_model = cls.env['res.partner']
        cls.parent_field = 'user_ids'
        cls.child_field = 'signature'
        cls.user_counter = 0
        cls.prepare_data(['<p>Kind regards</p>', '<p>Salutations</p>'])

    @classmethod
    def get_child_values(cls, param, count):
        login = f'user{cls.user_counter}'
        cls.user_counter += 1
        return {'login': login}


class TestMany2ManySubfield(SearchCase, TestSubfield):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.parent_model = cls.env['res.partner.category']
        cls.parent_field = 'partner_ids'
        cls.child_field = 'type'
        cls.prepare_data(['invoice', 'delivery'])

    @classmethod
    def get_child_values(cls, param, count):
        return {'name': 'Test partner'}


class TestMany2One2ManySubfield(SearchCase, TestSubfield):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.parent_model = cls.env['res.users']
        cls.parent_field = 'company_id.child_ids'
        cls.child_field = 'report_header'
        cls.company_counter = 0
        cls.prepare_data(['<p>Company A</p>', '<p>Company B</p>'])

    @classmethod
    def get_child_values(cls, param, count):
        counter = cls.company_counter
        cls.company_counter += 1
        return {'name': 'child_company' + str(counter)}

    @classmethod
    def get_parent_values(cls, values, params, counts):
        commands = values[cls.parent_field]
        path = cls.parent_field.split('.')
        unique_id = ''.join(str(count) for count in counts)
        company = cls.parent_model[path[0]].create({
            'name': 'company' + unique_id,
            path[1]: commands,
        })
        return super().get_parent_values({
            'login': 'user' + unique_id,
            'company_ids': [(4, company.id)],
            path[0]: company.id,
        }, params, counts)


class TestOne2Many2ManySubfield(SearchCase, TestSubfield):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.parent_model = cls.env['res.users']
        cls.parent_field = 'child_ids.child_ids'
        cls.child_field = 'type'
        cls.partner_counter = 0
        cls.prepare_data(['invoice', 'delivery'])

    @classmethod
    def get_child_values(cls, param, count):
        counter = cls.partner_counter
        cls.partner_counter += 1
        return {'name': 'child_partner' + str(counter)}

    @classmethod
    def get_parent_values(cls, values, params, counts):
        commands = values[cls.parent_field]
        path = cls.parent_field.split('.')
        unique_id = ''.join(str(count) for count in counts)
        partner = cls.parent_model[path[0]].create({
            'name': 'partner' + unique_id,
            path[1]: commands,
        })
        return super().get_parent_values({
            'login': 'user' + unique_id,
            path[0]: [(4, partner.id)],
        }, params, counts)
