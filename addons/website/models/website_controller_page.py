
# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from psycopg2 import sql
import re

from odoo.addons.http_routing.models.ir_http import slugify
from odoo.addons.website.tools import text_from_html
from odoo import api, fields, models
from odoo.osv import expression
from odoo.tools import escape_psql
from odoo.tools.translate import _


class ControllerPage(models.Model):
    _name = 'website.controller.page'
    _inherits = {'ir.ui.view': 'view_id'}
    _inherit = [
        'website.published.multi.mixin',
        'website.searchable.mixin',
    ]
    _description = 'Controller Page'
    _order = 'website_id'

    view_id = fields.Many2one('ir.ui.view', string='View', required=True, ondelete="cascade")
    menu_ids = fields.One2many('website.menu', 'page_id', 'Related Menus')

    website_id = fields.Many2one(related='view_id.website_id', store=True, readonly=False, ondelete='cascade')
    arch = fields.Text(related='view_id.arch', readonly=False, depends_context=('website_id',))

    # Bindings to model/records, to expose the page on the website.
    # Route: /model/<string:page_name_slugified>
    page_name = fields.Char(string="Page Name", help="The name of the page")
    name_slugified = fields.Char(compute="_compute_name_slugified", store=True,
        string="URL Name", help="The name of the page usable in a url")
    page_type = fields.Selection(selection=[("listing", "Listing"), ("single", "Single record")],
        string="Page Type", help="The type of the page. If set, it indicates whether the page displays a list of records or a single record")
    record_domain = fields.Char(string="Domain", help="Domain to restrict records that can be viewed publicly")


    @api.model
    def _get_page_url(self, page_name, additional_path=None):
        name_slugified = slugify(page_name)
        url = f"/model/{name_slugified}"
        if additional_path:
            additional_path = f"/{additional_path}" if not additional_path.startswith("/") else additional_path
            url += additional_path
        return name_slugified, url

    @api.depends("model_id", "page_name")
    def _compute_name_slugified(self):
        for rec in self:
            if not rec.model_id or not rec.page_type:
                continue
            rec.name_slugified = slugify(rec.page_name)


    def unlink(self):
        # When a website_page is deleted, the ORM does not delete its
        # ir_ui_view. So we got to delete it ourself, but only if the
        # ir_ui_view is not used by another website_page.
        views_to_delete = self.view_id.filtered(
            lambda v: v.page_ids <= self and not v.inherit_children_ids
        )
        # Rebind self to avoid unlink already deleted records from `ondelete="cascade"`
        self = self - views_to_delete.page_ids
        views_to_delete.unlink()

        # Make sure website._get_menu_ids() will be recomputed
        self.env.registry.clear_cache()
        return super().unlink()
    
    # TODO DAFL: verify once more that we did not omit an important method
