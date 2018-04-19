from odoo import models, fields, api
import datetime


class TestBase(models.Model):
    _name = "test.base"

    #used in test_search
    name = fields.Char(index=True)
    active = fields.Boolean(string="Active")
    color = fields.Integer(string='Color Index', default=0)
    parent_id = fields.Many2one('test.base', string='Parent')
    child_ids = fields.One2many('test.base', 'parent_id', string='Childs')
    reference = fields.Reference(string='Related Document',
        selection='_reference_models')
    test_only_read = fields.Many2one('test.base.only.read')

    many2one_id = fields.Many2many('test.many2one')

    @api.model
    def _reference_models(self):
        models = self.env['ir.model'].sudo().search([('state', '!=', 'manual')])
        return [(model.model, model.name)
                for model in models
                if not model.model.startswith('ir.')]


class TestBaseOnlyRead(models.Model):
    _name = "test.base.only.read"

    name = fields.Char("name")

class TestMany2one(models.Model):
    _name = "test.many2one"

    name = fields.Char("name")
    sub_many2one_id = fields.Many2many('test.sub.many2one')

class TestSubMany2one(models.Model):
    _name = "test.sub.many2one"

    name = fields.Char("name")
