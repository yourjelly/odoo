# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class FamilyMembersMixin(models.AbstractModel):
    _name = "test_many2many.members"
    _description = "Family Members"

    parent_ids = fields.Many2many("res.partner", rel="parent", string="Parents",)
    sibling_ids = fields.Many2many("res.partner", rel="sibling", string="Siblings",)


class Human(models.Model):
    _name = "test_many2many.human"
    _description = "Human"
    _inherit = ["test_many2many.members"]

    name = fields.Char("Name")
    company_id = fields.Many2one("res.company", string="Company",)


class Animal(models.Model):
    _name = "test_many2many.animal"
    _description = "Animal"
    _inherit = ["test_many2many.members"]

    owner_id = fields.Many2one("res.users", string="Owner",)


class ResPartner(models.Model):
    _inherit = "res.partner"

    parent_human_ids = fields.Many2many(
        "test_many2many.human",
        rel="parent",
        string="Humans to whom this partner is a parent.",
    )
    sibling_human_ids = fields.Many2many(
        "test_many2many.human",
        rel="sibling",
        string="Humans to whom this partner is a sibling.",
    )
    parent_animal_ids = fields.Many2many(
        "test_many2many.animal",
        rel="parent",
        string="Animals to whom this partner is a parent.",
    )
    sibling_animal_ids = fields.Many2many(
        "test_many2many.animal",
        rel="sibling",
        string="Animals to whom this partner is a sibling.",
    )


class ResUsers(models.Model):
    _inherit = "res.users"

    animal_ids = fields.One2many("test_many2many.animal", "owner_id")


class ResCompany(models.Model):
    _inherit = "res.users"

    working_human_ids = fields.One2many("test_many2many.human", "company_id")
