# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class TestBase(models.Model):
    _name = "test.base"
    _rec_name = 'name'

    #used in test_search
    name = fields.Char("Name", index=True, required=True, translate=True)
    active = fields.Boolean(string="Active", default=True)
    color = fields.Integer(string='Color Index', default=0)
    parent_id = fields.Many2one('test.base', string='Parent')
    child_ids = fields.One2many('test.base', 'parent_id', string='Childs')
    reference = fields.Reference(string='Related Document',
        selection='_reference_models')
    test_only_read = fields.Many2one('test.base.only.read')

    many2one_id = fields.Many2one('test.many2one')
    many2many_ids = fields.Many2many("test.many2many", column1='test_base_id', column2='many2many_id')
    boolean = fields.Boolean()
    one2many_ids = fields.One2many("test.one2many", 'test_base_id', auto_join=True)

    @api.model
    def _reference_models(self):
        models = self.env['ir.model'].sudo().search([('state', '!=', 'manual')])
        return [(model.model, model.name)
                for model in models
                if not model.model.startswith('ir.')]


class TestBaseOnlyRead(models.Model):
    _name = "test.base.only.read"

    name = fields.Char("Name")

class TestMany2one(models.Model):
    _name = "test.many2one"

    def _get_default_sub_many2one_id(self):
        return self.env.ref('test_base.test_sub_many2one_demo').id

    name = fields.Char("Name")
    sub_many2one_id = fields.Many2one('test.sub.many2one', required=True, default=_get_default_sub_many2one_id)

class TestSubMany2one(models.Model):
    _name = "test.sub.many2one"

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
