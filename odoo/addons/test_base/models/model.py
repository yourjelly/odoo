# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class TestBase(models.Model):
    _name = "test.base"

    name = fields.Char("Name", index=True, required=True, translate=True)
    active = fields.Boolean(default=True)
    boolean = fields.Boolean()
    color = fields.Integer(string='Color Index')
    date = fields.Date(index=True)
    parent_id = fields.Many2one('test.base', string='Parent')
    child_ids = fields.One2many('test.base', 'parent_id', string='Childs')
    many2one_id = fields.Many2one('test.many2one')
    many2many_ids = fields.Many2many("test.many2many", column1='test_base_id', column2='many2many_id')
    one2many_ids = fields.One2many("test.one2many", 'test_base_id', auto_join=True)
    #use in test case so need to add reference field when we deprecate reference fields then remove this and it's test case.
    reference = fields.Reference(string='Related Document', selection='_reference_models')
    #Full access rights to group_system and only read rights to group_user. For test many2one with only read rights.
    m2o_group_system_id = fields.Many2one('test.m2o.group.system')

    @api.model
    def _reference_models(self):
        models = self.env['ir.model'].sudo().search([('state', '!=', 'manual')])
        return [(model.model, model.name)
                for model in models
                if not model.model.startswith('ir.')]


class TestMany2one(models.Model):
    _name = "test.many2one"

    def _get_default_child_many2one_id(self):
        return self.env.ref('test_base.test_child_many2one_demo', False).id

    name = fields.Char("Name")
    child_m2o_id = fields.Many2one('test.child.many2one', required=True, default=_get_default_child_many2one_id)


class TestChildMany2one(models.Model):
    _name = "test.child.many2one"

    name = fields.Char("Name")


class TestMany2many(models.Model):
    _name = "test.many2many"

    name = fields.Char("Name")
    parent_id = fields.Many2one('test.many2many', string='Parent')
    child_ids = fields.One2many('test.many2many', 'parent_id', string='Childs')


class TestOne2many(models.Model):
    _name = "test.one2many"
    _inherits = {'test.base': 'test_base_id'}

    login = fields.Char("Login Id")
    test_base_id = fields.Many2one('test.base', required=True, ondelete='restrict', auto_join=True)
    name = fields.Char(related='test_base_id.name', inherited=True)


#Full access rights to group_system and only read rights to group_user
class TestM2oGroupSystem(models.Model):
    _name = "test.m2o.group.system"

    name = fields.Char("Name")
