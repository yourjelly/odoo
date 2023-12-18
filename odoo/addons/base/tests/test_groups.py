# -*- coding: utf-8 -*-

from odoo import Command
from odoo.tests import common
from odoo.addons.base.models import res_users
from odoo.exceptions import ValidationError


@common.tagged('at_install', 'groups')
class TestGroupsObject(common.BaseCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Group = res_users.GroupsObjectUnion(
            data={
                0: {
                    'ref': '*',
                    'greaters': {0},
                },
                1: {
                    'ref': 'A',
                    'greaters': {0, 1},
                },
                2: {
                    'ref': 'A1',
                    'greaters': {0, 1, 2},  # A1 implied A
                },
                3: {
                    'ref': 'A11',
                    'greaters': {0, 1, 2, 3},  # A11 implied A1, A
                },
                4: {
                    'ref': 'A2',
                    'greaters': {0, 1, 4},
                },
                5: {
                    'ref': 'A21',
                    'greaters': {0, 1, 4, 5},
                },
                6: {
                    'ref': 'A22',
                    'greaters': {0, 1, 4, 6},
                },
                7: {
                    'ref': 'B',
                    'greaters': {0, 7},
                },
                8: {
                    'ref': 'B1',
                    'greaters': {0, 7, 8},
                },
                9: {
                    'ref': 'B11',
                    'greaters': {0, 7, 8, 9},
                },
                10: {
                    'ref': 'B2',
                    'greaters': {0, 7, 10},
                },
                11: {
                    'ref': 'BX',
                    'greaters': {0, 7, 11},
                    'distincts': {8, 10},  # BX distinct B1, B2
                },
                12: {
                    'ref': 'A1B1',
                    'greaters': {0, 1, 2, 7, 8, 12},
                },
                13: {
                    'ref': 'C',
                    'greaters': {0, 13},
                },
                14: {
                    'ref': 'D',
                    'greaters': {0, 14},
                    'distincts': {1, 7, 15},  # D distinct A, B, E
                },
                15: {
                    'ref': 'E',
                    'greaters': {0, 15},
                    'distincts': {1, 7, 14},  # E distinct A, B, D
                },
                16: {
                    'ref': 'E1',
                    'greaters': {0, 15, 16},  # E1 implied E (then is distinct to A, B, D)
                },
            },
      )

    def test_groups_1_base(self):
        A = self.Group.define('A')
        B = self.Group.define('B')
        B1 = self.Group.define('B1')

        self.assertTrue(hash(A), 'Group object must be hashable')
        self.assertEqual(str(A), 'A')
        self.assertEqual(str(B), 'B')
        self.assertEqual(str(B1), 'B1')

    def test_groups_2_and(self):
        A = self.Group.define('A')
        A1 = self.Group.define('A1')
        B = self.Group.define('B')
        B1 = self.Group.define('B1')
        B11 = self.Group.define('B11')
        BX = self.Group.define('BX')
        every_one = self.Group.every_one()
        no_one = self.Group.no_one()

        self.assertEqual(str(A & B), 'A & B')
        self.assertEqual(str(B & A), 'A & B')
        self.assertEqual(str(B & BX), 'BX')
        self.assertEqual(str(B1 & BX), '~*')
        self.assertEqual(str(B11 & BX), '~*')
        self.assertEqual(str(no_one & no_one), '~*')
        self.assertEqual(str(A & every_one), 'A')
        self.assertEqual(str(A & no_one), '~*')
        self.assertEqual(str(A1 & ~A), '~*')
        self.assertEqual(str(A & A1 & every_one), 'A1')

    def test_groups_3_or(self):
        A = self.Group.define('A')
        A1 = self.Group.define('A1')
        B = self.Group.define('B')
        B1 = self.Group.define('B1')
        B11 = self.Group.define('B11')
        B2 = self.Group.define('B2')
        BX = self.Group.define('BX')
        every_one = self.Group.every_one()
        no_one = self.Group.no_one()

        self.assertEqual(str(A | A), 'A')
        self.assertEqual(str(A | B), 'A | B')
        self.assertEqual(str(A1 | A), 'A')
        self.assertEqual(str(A | A1), 'A')
        self.assertEqual(str(A | B1), 'A | B1')
        self.assertEqual(str(B | A), 'A | B')
        self.assertEqual(str(B | BX), 'B')
        self.assertEqual(str(B1 | BX), 'B1 | BX')
        self.assertEqual(str(B11 | BX), 'B11 | BX')
        self.assertEqual(str(no_one | no_one), '~*')
        self.assertEqual(str(A | B11 | B2), 'A | B11 | B2')
        self.assertEqual(str(A | B2 | B11), 'A | B11 | B2')
        self.assertEqual(str(A | no_one), 'A')
        self.assertEqual(str(A | every_one), '*')
        self.assertEqual(str((A | A1) | no_one), 'A')

    def test_groups_3_or_and(self):
        A = self.Group.define('A')
        A1 = self.Group.define('A1')
        A2 = self.Group.define('A2')
        B1 = self.Group.define('B1')
        B2 = self.Group.define('B2')
        every_one = self.Group.every_one()
        no_one = self.Group.no_one()

        self.assertEqual(str((A & B1) | B2), '(A & B1) | B2')
        self.assertEqual(str(A | B1 & B2), 'A | (B1 & B2)')
        self.assertEqual(str(A | A1 & every_one), 'A')
        self.assertEqual(str((A1 | A2) & (B1 | B2)), '(A1 & B1) | (A1 & B2) | (A2 & B1) | (A2 & B2)')
        self.assertEqual(str(A | (A1 | no_one)), 'A')
        self.assertEqual(str((A & A1) | no_one), 'A1')
        self.assertEqual(str(A & (A1 | no_one)), 'A1')

    def test_groups_4_gt_lt(self):
        A = self.Group.define('A')
        A1 = self.Group.define('A1')
        A11 = self.Group.define('A11')
        A2 = self.Group.define('A2')
        A21 = self.Group.define('A21')
        B = self.Group.define('B')
        B1 = self.Group.define('B1')
        B11 = self.Group.define('B11')
        B2 = self.Group.define('B2')
        A1B1 = self.Group.define('A1B1')

        self.assertEqual(A == A, True)
        self.assertEqual(A == B, False)

        self.assertEqual(A >= A1, True)
        self.assertEqual(A >= A, True)
        self.assertEqual((A & B) >= B, False)
        self.assertEqual(B1 >= A1B1, True)
        self.assertEqual(B1 >= (A1 | A1B1), False)  # noqa: SIM300
        self.assertEqual(B >= (A & B), True)  # noqa: SIM300

        self.assertEqual(A > B, False)
        self.assertEqual(A > A1, True)
        self.assertEqual(A1 > A, False)
        self.assertEqual(A > A, False)
        self.assertEqual(A > A11, True)
        self.assertEqual(A > A2, True)
        self.assertEqual(A > A21, True)
        self.assertEqual(A1 > A11, True)
        self.assertEqual(A2 > A11, False)
        self.assertEqual(A2 > A21, True)
        self.assertEqual(A > B1, False)
        self.assertEqual(A > B11, False)
        self.assertEqual(A > B2, False)

        self.assertEqual(A <= A, True)
        self.assertEqual(A1 <= A, True)
        self.assertEqual((A & B) <= B, True)
        self.assertEqual((A & B) <= A, True)
        self.assertEqual(B1 <= (A1 | A1B1), False)  # noqa: SIM300
        self.assertEqual(B <= (A & B), False)  # noqa: SIM300
        self.assertEqual(A <= (A & B), False)  # noqa: SIM300
        self.assertEqual(A <= (A | B), True)  # noqa: SIM300

        self.assertEqual(A < B, False)
        self.assertEqual(A < A1, False)
        self.assertEqual(A1 < A, True)
        self.assertEqual(A < A1, False)
        self.assertEqual(A < A11, False)
        self.assertEqual(A < A2, False)
        self.assertEqual(A < A21, False)
        self.assertEqual(A < B1, False)
        self.assertEqual(A < B11, False)
        self.assertEqual(A < B2, False)
        self.assertEqual(A < (A | B), True)  # noqa: SIM300

    def test_groups_5_invert(self):
        A = self.Group.define('A')
        A1 = self.Group.define('A1')
        A2 = self.Group.define('A2')
        B = self.Group.define('B')
        B1 = self.Group.define('B1')
        B11 = self.Group.define('B11')
        B2 = self.Group.define('B2')
        BX = self.Group.define('BX')
        every_one = self.Group.every_one()
        no_one = self.Group.no_one()

        self.assertEqual(str(~A), '~A')
        self.assertEqual(str(~A1), '~A1')
        self.assertEqual(str(~B), '~B')
        self.assertEqual(str(~every_one), '~*')
        self.assertEqual(str(~no_one), '*')

        self.assertEqual(str(~(A & B)), '~A | ~B')
        self.assertEqual(str(~(A | B)), '~A & ~B')
        self.assertEqual(str(~A & ~A1), '~A')

        self.assertEqual(str(A | ~A), '*')
        self.assertEqual(str(~A | ~A1), '~A1')
        self.assertEqual(str(~(A | A1)), '~A')
        self.assertEqual(~(A | A1), ~A & ~A1)
        self.assertEqual(str(~(A & A1)), '~A1')
        self.assertEqual(~(A & A1), ~A | ~A1)
        self.assertEqual(str(~(~B1 & ~B2)), 'B1 | B2')

        self.assertEqual(str(A & ~A), '~*')
        self.assertEqual(str(A & ~A1), 'A & ~A1')
        self.assertEqual(str(~A & A), '~*')
        self.assertEqual(str(~A & A1), '~*')
        self.assertEqual(str(~A1 & A), 'A & ~A1')
        self.assertEqual(str(B11 & ~BX), 'B11')
        self.assertEqual(str(~B1 & BX), 'BX')
        self.assertEqual(str(~B11 & BX), 'BX')

        self.assertEqual(str(~((A & B1) | B2)), '(~A & ~B2) | (~B1 & ~B2)')
        self.assertEqual(str(~(A | (B1 & B2))), '(~A & ~B1) | (~A & ~B2)')
        self.assertEqual(str(~(A | (B2 & B1))), '(~A & ~B1) | (~A & ~B2)')
        self.assertEqual(str(~((A1 & A2) | (B1 & B2))), '(~A1 & ~B1) | (~A1 & ~B2) | (~A2 & ~B1) | (~A2 & ~B2)')
        self.assertEqual(str((~A & ~B2)), '~A & ~B2')
        self.assertEqual(str(~(~B1 & ~B2)), 'B1 | B2')
        self.assertEqual(str(~((A & B) | A1)), '~A | (~A1 & ~B)')
        self.assertEqual(str(~(~A | (~A1 & ~B))), '(A & B) | A1')
        self.assertEqual(str(~~((A & B) | A1)), '(A & B) | A1')

    def test_groups_6_invert_gt_lt(self):
        A = self.Group.define('A')
        A1 = self.Group.define('A1')

        self.assertEqual(A < A1, False)
        self.assertEqual(~A < ~A1, True)
        self.assertEqual(A > A1, True)
        self.assertEqual(~A > ~A1, False)
        self.assertEqual(~A1 > ~A, True)
        self.assertEqual(A < ~A, False)  # noqa: SIM300
        self.assertEqual(A < ~A1, False)  # noqa: SIM300
        self.assertEqual(~A < ~A, False)
        self.assertEqual(~A < ~A1, True)

    def test_groups_7_various(self):
        A = self.Group.define('A')
        A1 = self.Group.define('A1')
        B = self.Group.define('B')

        self.assertEqual(str(~A & (A | B)), '~A & B')
        self.assertEqual(str(A1 & B & ~A), '~*')
        self.assertEqual(str(A1 & ~A & B), '~*')
        self.assertEqual(str(~A1 & A & B), 'A & ~A1 & B')

    def test_groups_8_reduce(self):
        A = self.Group.define('A')
        A1 = self.Group.define('A1')
        A11 = self.Group.define('A11')
        B = self.Group.define('B')
        B1 = self.Group.define('B1')
        B2 = self.Group.define('B2')
        every_one = self.Group.every_one()
        no_one = self.Group.no_one()

        self.assertEqual(str((A | B) & B), 'B')
        self.assertEqual(str((A & B) | (A & ~B)), 'A')
        self.assertEqual(str((A & B1 & B2) | (A & B1 & ~B2)), 'A & B1')
        self.assertEqual(str((A & ~B2 & B1) | (A & B1 & B2)), 'A & B1')
        self.assertEqual(str((A & B1 & ~B2) | (A & ~B1 & B2)), '(A & B1 & ~B2) | (A & ~B1 & B2)')
        self.assertEqual(str(((B2 & A1) | (B2 & A1 & A11)) | ((B2 & A11) | (~B2 & A1) | (~B2 & A1 & A11))), 'A1')
        self.assertEqual(str(~(((B2 & A1) | (B2 & A1 & A11)) | ((B2 & A11) | (~B2 & A1) | (~B2 & A1 & A11)))), '~A1')
        self.assertEqual(str(~((~A & B) | (A & B) | (A & ~B))), '~A & ~B')
        self.assertEqual(str((~A & ~B2) & (B1 | B2)), '~A & B1 & ~B2')
        self.assertEqual(str((~A & ~B2) & ~(~B1 & ~B2)), '~A & B1 & ~B2')
        self.assertEqual(str((~A & ~B2 & every_one)), '~A & ~B2')
        self.assertEqual(str((~A & ~B2 & every_one) & ~(~B1 & ~B2)), '~A & B1 & ~B2')
        self.assertEqual(str((~A & ~B2 & no_one) & ~(~B1 & ~B2)), '~*')
        self.assertEqual(str((~A & ~B2) & ~(~B1 & ~B2 & no_one)), '~A & ~B2')
        self.assertEqual(str((~A & B1 & A) & B), '~*')

    def test_groups_9_distinct(self):
        A = self.Group.define('A')
        A1 = self.Group.define('A1')
        A11 = self.Group.define('A11')
        A1B1 = self.Group.define('A1B1')
        B = self.Group.define('B')
        B1 = self.Group.define('B1')
        B11 = self.Group.define('B11')
        E = self.Group.define('E')
        E1 = self.Group.define('E1')

        self.assertEqual(A <= E, False)
        self.assertEqual(A >= E, False)
        self.assertEqual(A <= ~E, True)  # noqa: SIM300
        self.assertEqual(A >= ~E, False)  # noqa: SIM300
        self.assertEqual(A11 <= ~E, True)  # noqa: SIM300
        self.assertEqual(A11 >= ~E, False)  # noqa: SIM300
        self.assertEqual(~A >= E, True)
        self.assertEqual(~A11 >= E, True)
        self.assertEqual(~A >= ~E, False)
        self.assertEqual(~A11 >= ~E, True)
        self.assertEqual(A <= E1, False)
        self.assertEqual(A >= E1, False)
        self.assertEqual(A <= ~E1, True)  # noqa: SIM300
        self.assertEqual(A >= ~E1, False)  # noqa: SIM300
        self.assertEqual(A11 <= ~E1, True)  # noqa: SIM300
        self.assertEqual(A11 >= ~E1, False)  # noqa: SIM300
        self.assertEqual(~A >= E1, True)
        self.assertEqual(~A11 >= E1, True)
        self.assertEqual(~A >= ~E1, False)
        self.assertEqual(~A <= ~E1, True)
        self.assertEqual(~A11 >= ~E1, True)

        self.assertEqual(str(B11 & ~E), 'B11')
        self.assertEqual(str(~A11 | E), '~A11')
        self.assertEqual(str(~(A1 & A11 & ~E)), '~A11')
        self.assertEqual(str(B1 & E), '~*')
        self.assertEqual(str(B11 & E), '~*')
        self.assertEqual(str(B1 | E), 'B1 | E')
        self.assertEqual(str((B1 & E) | A1B1), 'A1B1')
        self.assertEqual(str(A1 & A11 & ~E), 'A11')
        self.assertEqual(str(~E & (E | B)), 'B')
        self.assertEqual(str((~E & E) | B), 'B')

    def test_groups_10_hudge_combine(self):
        A1 = self.Group.define('A1')
        A11 = self.Group.define('A11')
        B = self.Group.define('B')
        B1 = self.Group.define('B1')
        B2 = self.Group.define('B2')
        A1B1 = self.Group.define('A1B1')
        C = self.Group.define('C')
        D = self.Group.define('D')
        E = self.Group.define('E')

        Z1 = C | B2 | A1 | A11
        Z2 = (C) | (C & B2) | (C & B2 & A1) | (C & B2 & A11) | (C & ~B2) | (C & ~B2 & A1)
        Z3 = (C & ~B2 & A11) | (C & A1) | (C & A1 & B1) | (C & A11) | (C & A11 & B1) | (C & B1)
        Z4 = (B2 & A1) | (B2 & A1 & A11) | (B2 & A11) | (~B2 & A1) | (~B2 & A1 & A11)
        Z5 = (~B2 & A11) | (A1) | (A1 & A11) | (A1 & A11 & B1) | (A1 & B1) | (A11) | (A11 & B1)
        group1 = Z1 & (Z2 | Z3 | Z4 | Z5)

        self.assertEqual(str(group1), 'A1 | C')
        self.assertEqual(str(~group1), '~A1 & ~C')
        self.assertEqual(str(~~group1), 'A1 | C')
        self.assertEqual(str((~group1).invert_intersect(~A1)), '~C')

        self.assertEqual(str(group1 & B), '(A1 & B) | (B & C)')
        self.assertEqual(str(~(group1 & B)), '(~A1 & ~C) | ~B')
        self.assertEqual(str(~~(group1 & B)), '(A1 & B) | (B & C)')
        self.assertEqual(str((group1 & B).invert_intersect(B)), 'A1 | C')

        self.assertFalse((group1 & B).invert_intersect(A1))

        self.assertEqual(str(A1 & D), '~*')
        self.assertEqual(str(group1 & (C | B | D)), '(A1 & B) | C')
        self.assertEqual(str(~(group1 & (C | B | D))), '(~A1 & ~C) | (~B & ~C)')

        group2 = (B1 | D) & (A1B1 | (A1B1 & D) | (A1B1 & D & E) | (A1B1 & E) | E)
        self.assertEqual(str(group2), 'A1B1')

    def test_groups_11_invert_intersect(self):
        A = self.Group.define('A')
        A1 = self.Group.define('A1')
        A11 = self.Group.define('A11')
        A2 = self.Group.define('A2')
        A21 = self.Group.define('A21')
        A22 = self.Group.define('A22')
        B = self.Group.define('B')
        B1 = self.Group.define('B1')
        B2 = self.Group.define('B2')
        D = self.Group.define('D')

        self.assertEqual(str((A1 & A2).invert_intersect(A2)), 'A1')
        self.assertEqual(str((A1 & B1 | A1 & B2).invert_intersect(A1)), 'B1 | B2')
        self.assertEqual(str((A1 & B1 | A1 & B2 | A1 & A2).invert_intersect(A1)), 'A2 | B1 | B2')
        self.assertEqual(str((A1 & B1 | A2 & B1).invert_intersect(A1 | A2)), 'B1')
        self.assertEqual(str((A1 & B1 | A1 & B2 | A2 & B1 | A2 & B2).invert_intersect(A1 | A2)), 'B1 | B2')
        self.assertEqual(A.invert_intersect(A | B), None)
        self.assertEqual(A.invert_intersect(A1 | A2), None)
        self.assertEqual(A.invert_intersect(A | D), None)

        tests = [
            (A2, A1),
            (B1 | B2, A1),
            (A2 | B1 | B2, A1),
            (B1, A1 | A2),
            (B1 | B2, A1 | A2),
            (B1 & B2, A1),
            (A2 & B1 & B2, A1),
            (B1 & B2, A1 | A2),
            (A1, B1 & B2),
            (A1 | A2, B1 & B2),
            (A1, A2 | B1 & B2),
            (A11 | A21, A22 | B1 & B2),
            (A11 & A21, A22 | B1 & B2),
            (A, A1 | B),
            (A1 | B, A),
        ]
        for a, b in tests:
            self.assertEqual(str((a & b).invert_intersect(b)), str(a), f'Should invert_intersect: {a & b}\nby: ({b})')


@common.tagged('at_install', 'groups')
class TestGroupsOdoo(common.TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.test_group = cls.env['res.groups'].create({
            'name': 'test with implied user',
            'implied_ids': [Command.link(cls.env.ref('base.group_user').id)]
        })
        cls.env["ir.model.data"].create({
            "module": "base",
            "name": "base_test_group",
            "model": "res.groups",
            "res_id": cls.test_group.id,
        })
        cls.Group = cls.env['res.groups']._define_group()

    def test_groups_1_base(self):
        define = self.Group.define

        self.assertEqual(str(define('base.group_user') & define('base.group_user')), 'base.group_user')
        self.assertEqual(str(define('base.group_user') & define('base.group_system')), 'base.group_system')
        self.assertEqual(str(define('base.group_system') & define('base.group_user')), 'base.group_system')
        self.assertEqual(str(define('base.group_erp_manager') & define('base.group_system')), 'base.group_system')
        self.assertEqual(str(define('base.group_system') & define('base.group_allow_export')), 'base.group_system & base.group_allow_export')
        self.assertEqual(str(define('base.group_user') | define('base.group_user')), 'base.group_user')
        self.assertEqual(str(define('base.group_user') | define('base.group_system')), 'base.group_user')
        self.assertEqual(str(define('base.group_system') | define('base.group_public')), 'base.group_system | base.group_public')
        self.assertEqual(define('base.group_system') < define('base.group_erp_manager'), True)
        self.assertEqual(define('base.group_system') < define('base.group_sanitize_override'), True)
        self.assertEqual(define('base.group_erp_manager') < define('base.group_user'), True)
        self.assertEqual(define('!base.group_portal') < define('!base.group_public'), False)
        self.assertEqual(define('base.base_test_group') == define('base.base_test_group'), True)
        self.assertEqual(define('base.group_system') <= define('base.group_system'), True)
        self.assertEqual(define('base.group_public') <= define('base.group_system'), False)  # None ?
        self.assertEqual(define('base.group_user') <= define('base.group_system'), False)
        self.assertEqual(define('base.group_system') <= define('base.group_user'), True)
        self.assertEqual(define('base.group_user') <= define('base.group_portal'), False)
        self.assertEqual(define('!base.group_portal') <= define('!base.group_public'), False)

    def test_groups_2_from_commat_separator(self):
        define = self.Group.define

        self.assertEqual(str(define('base.group_user,base.group_system') & define('base.group_system')), 'base.group_system')
        self.assertEqual(str(define('base.group_user,base.group_erp_manager') & define('base.group_system')), 'base.group_system')
        self.assertEqual(str(define('base.group_user,base.group_portal') & define('base.group_portal')), 'base.group_portal')
        self.assertEqual(str(define('base.group_user,base.group_portal,base.group_public,base.group_multi_company') & define('base.group_portal,base.group_public')), 'base.group_portal | base.group_public')
        self.assertEqual(str(define('base.group_system,base.base_test_group') & define('base.group_user')), 'base.group_system | base.base_test_group')
        self.assertEqual(str(define('base.group_system,base.group_portal') & define('base.group_user')), 'base.group_system')
        self.assertEqual(str(define('base.group_user') & define('!base.group_portal,base.group_system')), 'base.group_system')
        self.assertEqual(str(define('!base.group_portal') & define('base.group_portal,base.group_system')), 'base.group_system')
        self.assertEqual(str(define('base.group_portal,!base.group_user') & define('base.group_user')), '~*')
        self.assertEqual(str(define('!base.group_user') & define('base.group_portal,base.group_user')), 'base.group_portal')
        self.assertEqual(str(define('base.group_user') & define('base.group_portal,!base.group_user')), '~*')
        self.assertEqual(str(define('!base.group_user') & define('base.group_portal,!base.group_system')), 'base.group_portal')
        self.assertEqual(str(define('!base.group_user,base.group_allow_export') & define('base.group_allow_export,!base.group_system')), '~base.group_user & base.group_allow_export')
        self.assertEqual(str(define('!base.group_user,base.group_portal') & define('base.group_portal,!base.group_system')), 'base.group_portal')
        self.assertEqual(str(define('!*') & define('base.group_portal')), '~*')
        self.assertEqual(str(define('*') & define('base.group_portal')), 'base.group_portal')
        self.assertEqual(str(define('base.group_system') & define('base.group_system,!base.group_no_one')), 'base.group_system & ~base.group_no_one')
        self.assertEqual(str(define('base.group_user,!base.group_system') & define('base.group_erp_manager,base.group_portal')), 'base.group_erp_manager & ~base.group_system')
        self.assertEqual(str(define('base.group_user,!base.group_system') & define('base.group_portal,base.group_erp_manager')), 'base.group_erp_manager & ~base.group_system')
        self.assertEqual(str(define('base.group_user') & define('base.group_portal,base.group_erp_manager,!base.group_system')), 'base.group_erp_manager & ~base.group_system')
        self.assertEqual(str(define('base.group_user') & define('base.group_portal,base.group_system')), 'base.group_system')
        self.assertEqual(str(define('base.group_user,base.group_system') & define('base.group_portal,base.group_system')), 'base.group_system')
        self.assertEqual(str(define('base.group_user') & define('base.group_portal,base.group_erp_manager')), 'base.group_erp_manager')
        self.assertEqual(str(define('base.group_user') & define('base.group_portal,!base.group_system')), '~*')
        self.assertEqual(str(define('base.group_user,base.group_system') & define('base.group_system,base.group_portal')), 'base.group_system')
        self.assertEqual(str(define('base.group_user') & define('base.group_system,base.group_portal')), 'base.group_system')
        self.assertEqual(str(define('base.group_user,base.group_system') & define('base.group_allow_export')), 'base.group_user & base.group_allow_export')
        self.assertEqual(str(define('base.group_user,base.group_erp_manager') | define('base.group_system')), 'base.group_user')
        self.assertEqual(str(define('base.group_user') | define('base.group_portal,base.group_system')), 'base.group_user | base.group_portal')
        self.assertEqual(str(define('!*') | define('base.group_user')), 'base.group_user')
        self.assertEqual(str(define('base.group_user') | define('!*')), 'base.group_user')
        self.assertEqual(str(define('!*') | define('base.group_user,base.group_portal')), 'base.group_user | base.group_portal')
        self.assertEqual(str(define('*') | define('base.group_user')), '*')
        self.assertEqual(str(define('base.group_user') | define('*')), '*')
        self.assertEqual(str(define('base.group_user,base.group_erp_manager') | define('base.group_system,base.group_public')), 'base.group_user | base.group_public')
        self.assertEqual(define('base.group_system') < define('base.group_erp_manager,base.group_sanitize_override'), True)
        self.assertEqual(define('!base.group_public,!base.group_portal') < define('!base.group_public'), True)
        self.assertEqual(define('base.group_system,base.base_test_group') == define('base.group_system,base.base_test_group'), True)
        self.assertEqual(define('base.group_system,base.base_test_group') == define('base.base_test_group,base.group_system'), True)
        self.assertEqual(define('base.group_system,base.base_test_group') == define('base.base_test_group,base.group_public'), False)
        self.assertEqual(define('base.group_system,base.base_test_group') == define('base.base_test_group'), False)
        self.assertEqual(define('base.group_user') <= define('base.group_system,base.group_public'), False)
        self.assertEqual(define('base.group_system') <= define('base.group_user,base.group_public'), True)
        self.assertEqual(define('base.group_public') <= define('base.group_system,base.group_public'), True)
        self.assertEqual(define('base.group_system,base.group_public') <= define('base.group_system,base.group_public'), True)
        self.assertEqual(define('base.group_system,base.group_public') <= define('base.group_user,base.group_public'), True)
        self.assertEqual(define('base.group_system,!base.group_public') <= define('base.group_system'), True)
        self.assertEqual(define('base.group_system,!base.group_allow_export') <= define('base.group_system'), True)
        self.assertEqual(define('base.group_system,!base.group_no_one') <= define('base.group_system'), True)
        self.assertEqual(define('base.group_system') <= define('base.group_system,!base.group_no_one'), False)
        self.assertEqual(define('base.group_system') <= define('base.group_system,!base.group_allow_export'), False)
        self.assertEqual(define('base.group_system') <= define('base.group_system,!base.group_public'), True)
        self.assertEqual(define('base.group_system') == define('base.group_system,!base.group_public'), True)
        self.assertEqual(define('!base.group_public,!base.group_portal') <= define('!base.group_public'), True)
        self.assertEqual(define('base.group_user,!base.group_allow_export') <= define('base.group_user,!base.group_system,!base.group_allow_export'), False)
        self.assertEqual(define('base.group_system,!base.group_portal,!base.group_public') <= define('base.group_system,!base.group_public'), True)

    def test_groups_3_from_ref(self):
        define = self.Group.define_from_repr

        self.assertEqual(str(define('base.group_user & base.group_portal | base.group_user & ~base.group_system') & define('base.group_public')), '~*')
        self.assertEqual(str(define('base.group_user & base.group_portal | base.group_user & ~base.group_system') & define('~base.group_user')), '~*')
        self.assertEqual(str(define('base.group_user & base.group_portal | base.group_user & ~base.group_system') & define('~base.group_user & base.group_portal')), '~*')
        self.assertEqual(str(define('base.group_user & base.group_portal | base.group_user & base.group_system') & define('base.group_user & ~base.group_portal')), 'base.group_system')
        self.assertEqual(str(define('base.group_public & base.group_erp_manager | base.group_public & base.group_portal') & define('*')), '~*')
        self.assertEqual(str(define('base.group_system & base.group_allow_export') & define('base.group_portal | base.group_system')), 'base.group_system & base.group_allow_export')
        self.assertEqual(str(define('base.group_portal & base.group_erp_manager') | define('base.group_erp_manager')), 'base.group_erp_manager')
        self.assertEqual(define('base.group_system & base.group_allow_export') < define('base.group_system'), True)
        self.assertEqual(define('base.base_test_group') == define('base.base_test_group & base.group_user'), True)
        self.assertEqual(define('base.group_system | base.base_test_group') == define('base.group_system & base.group_user | base.base_test_group & base.group_user'), True)
        self.assertEqual(define('base.group_public & base.group_allow_export') <= define('base.group_public'), True)
        self.assertEqual(define('base.group_public') <= define('base.group_public & base.group_allow_export'), False)
        self.assertEqual(define('base.group_public & base.group_user') <= define('base.group_portal'), True)
        self.assertEqual(define('base.group_public & base.group_user') <= define('base.group_public | base.group_user'), True)
        self.assertEqual(define('base.group_public & base.group_system') <= define('base.group_user'), True)
        self.assertEqual(define('base.group_public & base.group_system') <= define('base.group_portal | base.group_user'), True)
        self.assertEqual(define('base.group_public & base.group_allow_export') <= define('~base.group_public'), False)
        self.assertEqual(define('(base.group_portal & base.group_public | base.group_system & base.group_public') <= define('base.group_public'), True)
        self.assertEqual(define('(base.group_portal & base.group_user | base.group_system & base.group_user') <= define('base.group_user'), True)
        self.assertEqual(define('(base.group_portal & base.group_system | base.group_user & base.group_system') <= define('base.group_system'), True)
        self.assertEqual(define('(base.group_portal & base.group_user | base.group_user & base.group_user') <= define('base.group_user'), True)
        self.assertEqual(define('(base.group_portal & base.group_user | base.group_user & base.group_user') <= define('base.group_user'), True)
        self.assertEqual(define('base.group_public') <= define('base.group_portal & base.group_public | base.group_system & base.group_public'), False)
        self.assertEqual(define('base.group_user & base.group_allow_export') <= define('base.group_user & base.group_system & base.group_allow_export'), False)
        self.assertEqual(define('base.group_system & base.group_allow_export') <= define('base.group_user & base.group_system & base.group_allow_export'), True)
        self.assertEqual(define('base.group_system & base.group_allow_export') <= define('base.group_system'), True)
        self.assertEqual(define('base.group_public') >= define('base.group_portal & base.group_public | base.group_system & base.group_public'), True)
        self.assertEqual(define('base.group_user & base.group_public') >= define('base.group_user & base.group_portal & base.group_public | base.group_user & base.group_system & base.group_public'), True)
        self.assertEqual(define('base.group_system & base.group_allow_export') >= define('base.group_system'), False)
        self.assertEqual(define('base.group_system & base.group_allow_export') > define('base.group_system'), False)

    def test_groups_4_contains_user(self):
        # user is included into the defined group of users

        user = self.env['res.users'].create({
            'name': 'A User',
            'login': 'a_user',
            'email': 'a@user.com',
        })

        with self.assertRaisesRegex(ValueError, "You can only check access for one user."):
            True in self.Group.define('base.group_public')

        with self.assertRaisesRegex(ValueError, "You can only check access for one user."):
            self.env['res.users'].search([]) in self.Group.define('base.group_public')

        self.assertFalse(self.env['res.users'] in self.Group.define('base.group_public'))
        self.assertFalse(self.env['res.users'] in self.Group.define('*'))
        self.assertFalse(self.env['res.users'] in ~self.Group.define('*'))

        tests = [
            # group on the user, # groups access, access
            ('base.group_public', 'base.group_system | base.group_public', True),
            ('base.group_public,base.group_allow_export', 'base.group_user | base.group_public', True),
            ('base.group_public', 'base.group_system & base.group_public', False),
            ('base.group_public', 'base.group_system | base.group_portal', False),
            ('base.group_public', 'base.group_system & base.group_portal', False),
            ('base.group_system', 'base.group_system | base.group_public', True),
            ('base.group_system', 'base.group_system & base.group_public', False),
            ('base.group_system', 'base.group_user | base.group_system', True),
            ('base.group_system', 'base.group_user & base.group_system', True),
            ('base.group_public', 'base.group_user | base.group_system', False),
            ('base.group_public', 'base.group_user & base.group_system', False),
            ('base.group_system', 'base.group_system & ~base.group_user', False),
            ('base.group_portal', 'base.group_system & ~base.group_user', False),
            ('base.group_user', 'base.group_user & ~base.group_system', True),
            ('base.group_user', '~base.group_system & base.group_user', True),
            ('base.group_system', 'base.group_user & ~base.group_system', False),
            ('base.group_portal', 'base.group_portal & ~base.group_user', True),
            ('base.group_system', '~base.group_system & base.group_user', False),
            ('base.group_system', '~base.group_system & ~base.group_user', False),
            ('base.group_user', 'base.group_user & base.group_sanitize_override & base.group_allow_export', False),
            ('base.group_system', 'base.group_user & base.group_sanitize_override & base.group_allow_export', False),
            ('base.group_system,base.group_allow_export', 'base.group_user & base.group_sanitize_override & base.group_allow_export', True),
            ('base.group_user,base.group_sanitize_override,base.group_allow_export', 'base.group_user & base.group_sanitize_override & base.group_allow_export', True),
            ('base.group_user', 'base.group_erp_manager | base.group_multi_company', False),
            ('base.group_user,base.group_erp_manager', 'base.group_erp_manager | base.group_multi_company', True),
        ]
        for user_groups, groups, result in tests:
            user.groups_id = [(6, 0, [self.env.ref(xmlid).id for xmlid in user_groups.split(',')])]
            group = self.Group.define_from_repr(groups)
            self.assertEqual(user in group, result, f'User ({user_groups!r}) should {"" if result else "not "}have access to groups: ({groups!r})')

    def test_groups_5_distinct(self):
        user = self.env['res.users'].create({
            'name': 'A User',
            'login': 'a_user',
            'email': 'a@user.com',
            'groups_id': self.env.ref('base.group_user').ids,
        })
        with self.assertRaisesRegex(ValidationError, "The user cannot have more than one user types."):
            user.groups_id = [(4, self.env.ref('base.group_public').id)]
        with self.assertRaisesRegex(ValidationError, "The user cannot have more than one user types."):
            user.groups_id = [(4, self.env.ref('base.group_portal').id)]
