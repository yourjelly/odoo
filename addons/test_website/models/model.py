# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class TestModel(models.Model):
    """ Add website option in server actions. """

    _name = 'test.model'
    _inherit = [
        'website.seo.metadata',
        'website.published.mixin',
        'website.searchable.mixin',
    ]
    _description = 'Website Model Test'

    name = fields.Char(required=True)

    @api.model
    def _search_get_detail(self, website, order, options):
        return {
            'model': 'test.model',
            'base_domain': [],
            'search_fields': ['name'],
            'fetch_fields': ['name'],
            'mapping': {
                'name': {'name': 'name', 'type': 'text', 'match': True},
                'website_url': {'name': 'name', 'type': 'text', 'truncate': False},
            },
            'icon': 'fa-check-square-o',
            'order': 'name asc, id desc',
        }


class TestModelExposed(models.Model):
    _name = "test.model.exposed"
    _inherit = [
        'website.seo.metadata',
        'website.published.mixin',
    ]
    _description = 'Website Model Test Exposed'
    _rec_name = "name"

    name = fields.Char()


class WebsiteMailTestPortal(models.Model):
    """ A model inheriting from mail.thread and portal.mixin with some fields
    used for portal sharing, like a partner, ... (similar model as defined in
    test_portal for testing with the website module) """
    _description = 'Chatter Model for Portal'
    _name = 'website.mail.test.portal'
    _inherit = [
        'portal.mixin',
        'mail.thread',
    ]

    name = fields.Char('Name')
    partner_id = fields.Many2one('res.partner', 'Customer')
    user_id = fields.Many2one('res.users', 'Salesperson')

    def _compute_access_url(self):
        super()._compute_access_url()
        for record in self.filtered('id'):
            record.access_url = '/my/website_test_portal/%s' % self.id
