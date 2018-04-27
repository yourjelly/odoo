# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class TestBase(models.Model):
    _name = "test_base.model"

    name = fields.Char("Name", index=True, required=True, translate=True)
    active = fields.Boolean(default=True)
    boolean = fields.Boolean()
    color = fields.Integer(string='Color Index')
    date = fields.Date(index=True)
    parent_id = fields.Many2one('test_base.model', string='Parent')
    child_ids = fields.One2many('test_base.model', 'parent_id', string='Childs')
    many2one_id = fields.Many2one('test_base.many2one')
    many2many_ids = fields.Many2many("test_base.many2many", column1='test_base_model_id', column2='many2many_id')
    one2many_ids = fields.One2many("test_base.one2many", 'test_base_model_id', auto_join=True)
    #use in test case so need to add reference field when we deprecate reference fields then remove this and it's test case.
    reference = fields.Reference(string='Related Document', selection='_reference_models')
    #Full access rights to group_system and only read access rights to group_user. For test many2one with only read rights.
    m2o_group_system_id = fields.Many2one('test_base.m2o.group.system')

    @api.model
    def _reference_models(self):
        models = self.env['ir.model'].sudo().search([('state', '!=', 'manual')])
        return [(model.model, model.name)
                for model in models
                if not model.model.startswith('ir.')]


class TestbaseMany2one(models.Model):
    _name = "test_base.many2one"

    def _get_default_child_many2one_id(self):
        return self.env.ref('test_base.child_many2one_test', False).id

    name = fields.Char("Name")
    child_m2o_id = fields.Many2one('test_base.child.many2one', required=True, default=_get_default_child_many2one_id)


class TestbaseChildMany2one(models.Model):
    _name = "test_base.child.many2one"

    name = fields.Char("Name")


class TestbaseMany2many(models.Model):
    _name = "test_base.many2many"

    name = fields.Char("Name")
    parent_id = fields.Many2one('test_base.many2many', string='Parent')
    child_ids = fields.One2many('test_base.many2many', 'parent_id', string='Childs')


class TestbaseOne2many(models.Model):
    _name = "test_base.one2many"
    _inherits = {'test_base.model': 'test_base_model_id'}

    login = fields.Char("Login Id")
    test_base_model_id = fields.Many2one('test_base.model', required=True, ondelete='restrict', auto_join=True)
    name = fields.Char(related='test_base_model_id.name', inherited=True)
    password = fields.Char(default='', invisible=True, copy=False)
    signature = fields.Html()


#Full access rights to group_system and only read access rights to group_user
class TestbaseM2oGroupSystem(models.Model):
    _name = "test_base.m2o.group.system"

    name = fields.Char("Name")
