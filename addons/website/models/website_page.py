# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from psycopg2 import sql
import re

from odoo.addons.http_routing.models.ir_http import slugify
from odoo.addons.website.tools import text_from_html
from odoo import api, fields, models
from odoo.osv import expression
from odoo.tools import escape_psql
from odoo.tools.safe_eval import safe_eval


class Page(models.Model):
    _name = 'website.page'
    _inherits = {'ir.ui.view': 'view_id'}
    _inherit = [
        'website.published.multi.mixin',
        'website.searchable.mixin',
    ]
    _description = 'Page'
    _order = 'website_id'

    url = fields.Char('Page URL')
    view_id = fields.Many2one('ir.ui.view', string='View', required=True, ondelete="cascade")
    website_indexed = fields.Boolean('Is Indexed', default=True)
    date_publish = fields.Datetime('Publishing Date')
    menu_ids = fields.One2many('website.menu', 'page_id', 'Related Menus')
    # This is needed to be able to control if page is a menu in page properties.
    is_menu = fields.Boolean(compute='_compute_website_menu', inverse='_set_website_menu', string='Is In Menu')
    is_homepage = fields.Boolean(compute='_compute_homepage', inverse='_set_homepage', string='Homepage')
    is_visible = fields.Boolean(compute='_compute_visible', string='Is Visible')

    # Page options
    header_overlay = fields.Boolean()
    header_color = fields.Char()
    header_visible = fields.Boolean(default=True)
    footer_visible = fields.Boolean(default=True)

    # don't use mixin website_id but use website_id on ir.ui.view instead
    website_id = fields.Many2one(related='view_id.website_id', store=True, readonly=False, ondelete='cascade')
    arch = fields.Text(related='view_id.arch', readonly=False, depends_context=('website_id',))

    def _compute_homepage(self):
        for page in self:
            page.is_homepage = page == self.env['website'].get_current_website().homepage_id

    def _set_homepage(self):
        for page in self:
            website = self.env['website'].get_current_website()
            if page.is_homepage:
                if website.homepage_id != page:
                    website.write({'homepage_id': page.id})
            else:
                if website.homepage_id == page:
                    website.write({'homepage_id': None})

    def _compute_visible(self):
        for page in self:
            page.is_visible = page.website_published and (
                not page.date_publish or page.date_publish < fields.Datetime.now()
            )

    @api.depends('menu_ids')
    def _compute_website_menu(self):
        for page in self:
            page.is_menu = bool(page.menu_ids)

    def _set_website_menu(self):
        for page in self:
            website = self.env['website'].get_current_website()
            if page.is_menu:
                if not page.menu_ids:
                    self.env['website.menu'].create({
                        'name': page.name,
                        'url': page.url,
                        'page_id': page.id,
                        'parent_id': website.menu_id.id,
                        'website_id': website.id,
                    })
            elif page.menu_ids:
                page.menu_ids.unlink()

    def _get_most_specific_pages(self):
        ''' Returns the most specific pages in self. '''
        ids = []
        previous_page = None
        # Iterate a single time on the whole list sorted on specific-website first.
        for page in self.sorted(key=lambda p: (p.url, not p.website_id)):
            if not previous_page or page.url != previous_page.url:
                ids.append(page.id)
            previous_page = page
        return self.filtered(lambda page: page.id in ids)

    def get_page_properties(self):
        self.ensure_one()
        res = self.read([
            'id', 'view_id', 'name', 'url', 'website_published', 'website_indexed', 'date_publish',
            'menu_ids', 'is_homepage', 'website_id', 'visibility', 'groups_id'
        ])[0]
        if not res['groups_id']:
            res['group_id'] = self.env.ref('base.group_user').name_get()[0]
        elif len(res['groups_id']) == 1:
            res['group_id'] = self.env['res.groups'].browse(res['groups_id']).name_get()[0]
        del res['groups_id']

        res['visibility_password'] = res['visibility'] == 'password' and self.visibility_password_display or ''
        return res

    @api.returns('self', lambda value: value.id)
    def copy(self, default=None):
        if default:
            if not default.get('view_id'):
                view = self.env['ir.ui.view'].browse(self.view_id.id)
                new_view = view.copy({'website_id': default.get('website_id')})
                default['view_id'] = new_view.id

            default['url'] = default.get('url', self.env['website'].get_unique_path(self.url))
        return super(Page, self).copy(default=default)

    @api.model
    def clone_page(self, page_id, page_name=None, clone_menu=True):
        """ Clone a page, given its identifier
            :param page_id : website.page identifier
        """
        page = self.browse(int(page_id))
        copy_param = dict(name=page_name or page.name, website_id=self.env['website'].get_current_website().id)
        if page_name:
            page_url = '/' + slugify(page_name, max_length=1024, path=True)
            copy_param['url'] = self.env['website'].get_unique_path(page_url)

        new_page = page.copy(copy_param)
        # Should not clone menu if the page was cloned from one website to another
        # Eg: Cloning a generic page (no website) will create a page with a website, we can't clone menu (not same container)
        if clone_menu and new_page.website_id == page.website_id:
            menu = self.env['website.menu'].search([('page_id', '=', page_id)], limit=1)
            if menu:
                # If the page being cloned has a menu, clone it too
                menu.copy({'url': new_page.url, 'name': new_page.name, 'page_id': new_page.id})

        return new_page.url

    def unlink(self):
        # When a website_page is deleted, the ORM does not delete its
        # ir_ui_view. So we got to delete it ourself, but only if the
        # ir_ui_view is not used by another website_page.
        for page in self:
            # Other pages linked to the ir_ui_view of the page being deleted (will it even be possible?)
            pages_linked_to_iruiview = self.search(
                [('view_id', '=', page.view_id.id), ('id', '!=', page.id)]
            )
            if not pages_linked_to_iruiview and not page.view_id.inherit_children_ids:
                # If there is no other pages linked to that ir_ui_view, we can delete the ir_ui_view
                page.view_id.unlink()
        # Make sure website._get_menu_ids() will be recomputed
        self.clear_caches()
        return super(Page, self).unlink()

    def write(self, vals):
        if 'url' in vals:
            vals['url'] = ('/' if not vals['url'].startswith('/') else '') + vals['url']
            for page in self:
                page.menu_ids.write({'url': vals['url']})
        self.clear_caches()  # write on page == write on view that invalid cache
        return super(Page, self).write(vals)

    def get_website_meta(self):
        self.ensure_one()
        return self.view_id.get_website_meta()

    @api.model
    def _search_get_detail(self, website, order, options):
        with_description = options['displayDescription']
        # Read access on website.page requires sudo.
        requires_sudo = True
        domain = [website.website_domain()]
        if not self.env.user.has_group('website.group_website_designer'):
            # Rule must be reinforced because of sudo.
            domain.append([('website_published', '=', True)])

        search_fields = ['name', 'url']
        fetch_fields = ['id', 'name', 'url']
        mapping = {
            'name': {'name': 'name', 'type': 'text', 'match': True},
            'website_url': {'name': 'url', 'type': 'text', 'truncate': False},
        }
        if with_description:
            search_fields.append('arch_db')
            fetch_fields.append('arch')
            mapping['description'] = {'name': 'arch', 'type': 'text', 'html': True, 'match': True}
        return {
            'model': 'website.page',
            'base_domain': domain,
            'requires_sudo': requires_sudo,
            'search_fields': search_fields,
            'fetch_fields': fetch_fields,
            'mapping': mapping,
            'icon': 'fa-file-o',
        }

    @api.model
    def _search_fetch(self, search_detail, search, limit, order):
        with_description = 'description' in search_detail['mapping']
        results, count = super()._search_fetch(search_detail, search, limit, order)
        if with_description and search:
            # Perform search in translations
            # TODO Remove when domains will support xml_translate fields
            query = sql.SQL("""
                SELECT {table}.{id}
                FROM {table}
                LEFT JOIN ir_ui_view v ON {table}.{view_id} = v.{id}
                LEFT JOIN ir_translation t ON v.{id} = t.{res_id}
                WHERE t.lang = {lang}
                AND t.name = ANY({names})
                AND t.type = 'model_terms'
                AND t.value ilike {search}
                LIMIT {limit}
            """).format(
                table=sql.Identifier(self._table),
                id=sql.Identifier('id'),
                view_id=sql.Identifier('view_id'),
                res_id=sql.Identifier('res_id'),
                lang=sql.Placeholder('lang'),
                names=sql.Placeholder('names'),
                search=sql.Placeholder('search'),
                limit=sql.Placeholder('limit'),
            )
            self.env.cr.execute(query, {
                'lang': self.env.lang,
                'names': ['ir.ui.view,arch_db', 'ir.ui.view,name'],
                'search': '%%%s%%' % escape_psql(search),
                'limit': limit,
            })
            ids = {row[0] for row in self.env.cr.fetchall()}
            ids.update(results.ids)
            domains = search_detail['base_domain'].copy()
            domains.append([('id', 'in', list(ids))])
            domain = expression.AND(domains)
            model = self.sudo() if search_detail.get('requires_sudo') else self
            results = model.search(
                domain,
                limit=limit,
                order=search_detail.get('order', order)
            )
            count = max(count, len(results))

        def filter_page(search, page, all_pages):
            # Search might have matched words in the xml tags and parameters therefore we make
            # sure the terms actually appear inside the text.
            text = '%s %s %s' % (page.name, page.url, text_from_html(page.arch))
            pattern = '|'.join([re.escape(search_term) for search_term in search.split()])
            return re.findall('(%s)' % pattern, text, flags=re.I) if pattern else False
        if 'url' not in order:
            results = results._get_most_specific_pages()
        if search and with_description:
            results = results.filtered(lambda result: filter_page(search, result, results))
        return results, count

# this is just a dummy function to be used as ormcache key
def _cached_response():
    pass
