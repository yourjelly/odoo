# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common
from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestMany2many(common.TransactionCase):
    def test_00_inherits(self):
        parent_1 = self.env.ref("test_many2many.parent_1")
        parent_2 = self.env.ref("test_many2many.parent_2")
        parent_3 = self.env.ref("test_many2many.parent_3")
        sibling_1 = self.env.ref("test_many2many.sibling_1")
        sibling_2 = self.env.ref("test_many2many.sibling_2")
        sibling_3 = self.env.ref("test_many2many.sibling_3")
        sibling_4 = self.env.ref("test_many2many.sibling_4")
        sibling_5 = self.env.ref("test_many2many.sibling_5")
        human_1 = self.env.ref("test_many2many.human_1")
        human_2 = self.env.ref("test_many2many.human_2")
        animal_1 = self.env.ref("test_many2many.animal_1")
        animal_2 = self.env.ref("test_many2many.animal_2")
        admin_user = self.env.ref("base.user_admin")
        main_company = self.env.ref("base.main_company")

        ## HUMANS ##

        # check humans 1 and 2 parents
        self.assertEqual(human_1.parent_ids, parent_1 | parent_2)
        self.assertEqual(human_2.parent_ids, parent_3 | parent_2)

        # check parents to whom they are parents
        self.assertEqual(parent_1.parent_human_ids, human_1)
        self.assertEqual(parent_2.parent_human_ids, human_2 | human_1)
        self.assertEqual(parent_3.parent_human_ids, human_2)

        # check human 1 and 2 siblings
        self.assertEqual(human_1.sibling_ids, sibling_1 | sibling_2)
        self.assertEqual(human_2.sibling_ids, sibling_3 | sibling_2)

        # check siblings to whom they are siblings
        self.assertEqual(sibling_1.sibling_human_ids, human_1)
        self.assertEqual(sibling_2.sibling_human_ids, human_1 | human_2)
        self.assertEqual(sibling_3.sibling_human_ids, human_2)

        ## ANIMALS ##

        # check animal 1 and 2 parents
        self.assertEqual(animal_1.parent_ids, parent_1 | parent_2)
        self.assertEqual(animal_2.parent_ids, parent_1 | parent_3)

        # check parents to whom they are parents to the animal
        self.assertEqual(parent_1.parent_animal_ids, animal_1 | animal_2)
        self.assertEqual(parent_2.parent_animal_ids, animal_1)
        self.assertEqual(parent_3.parent_animal_ids, animal_2)

        # check animal 1 and 2 siblings
        self.assertEqual(animal_1.sibling_ids, sibling_4 | sibling_5)
        self.assertEqual(animal_2.sibling_ids, sibling_4 | sibling_5)

        # check siblings to whom they are siblings to the animal
        self.assertEqual(sibling_4.sibling_animal_ids, animal_1 | animal_2)
        self.assertEqual(sibling_5.sibling_animal_ids, animal_1 | animal_2)

        ## OTHERS ##

        # animal 1 and human 1 have the same parents
        self.assertEqual(animal_1.parent_ids, human_1.parent_ids)
