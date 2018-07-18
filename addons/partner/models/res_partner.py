# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64
import datetime
import pytz

from odoo.modules import get_module_resource
from odoo.osv.expression import get_unaccent_wrapper
from odoo import api, fields, models, tools, _

class PartnerCategory(models.Model):
    _description = 'Partner Tags'
    _name = 'res.partner.category'
    _order = 'name'
    _parent_store = True

    name = fields.Char(string='Tag Name', required=True, translate=True)
    color = fields.Integer(string='Color Index')
    parent_id = fields.Many2one('res.partner.category', string='Parent Category', index=True, ondelete='cascade')
    child_ids = fields.One2many('res.partner.category', 'parent_id', string='Child Tags')
    active = fields.Boolean(default=True, help="The active field allows you to hide the category without removing it.")
    parent_path = fields.Char(index=True)
    partner_ids = fields.Many2many('res.partner', column1='category_id', column2='partner_id', string='Partners')

    @api.multi
    def name_get(self):
        """ Return the categories' display name, including their direct
            parent by default.

            If ``context['partner_category_display']`` is ``'short'``, the short
            version of the category name (without the direct parent) is used.
            The default is the long version.
        """
        if self._context.get('partner_category_display') == 'short':
            return super(PartnerCategory, self).name_get()

        res = []
        for category in self:
            names = []
            current = category
            while current:
                names.append(current.name)
                current = current.parent_id
            res.append((category.id, ' / '.join(reversed(names))))
        return res

    @api.model
    def _name_search(self, name, args=None, operator='ilike', limit=100, name_get_uid=None):
        args = args or []
        if name:
            # Be sure name_search is symetric to name_get
            name = name.split(' / ')[-1]
            args = [('name', operator, name)] + args
        partner_category_ids = self._search(args, limit=limit, access_rights_uid=name_get_uid)
        return self.browse(partner_category_ids).name_get()


class PartnerTitle(models.Model):
    _name = 'res.partner.title'
    _order = 'name'

    name = fields.Char(string='Title', required=True, translate=True)
    shortcut = fields.Char(string='Abbreviation', translate=True)


class Partner(models.Model):
    _description = 'Contact'
    _inherit = 'res.partner'
    _name = "res.partner"

    def _default_category(self):
        return self.env['res.partner.category'].browse(self._context.get('category_id'))

    date = fields.Date(index=True)
    title = fields.Many2one('res.partner.title')
    ref = fields.Char(string='Internal Reference', index=True)
    tz_offset = fields.Char(compute='_compute_tz_offset', string='Timezone offset', invisible=True)
    comment = fields.Text(string='Notes')
    bank_ids = fields.One2many('res.partner.bank', 'partner_id', string='Banks')
    category_id = fields.Many2many('res.partner.category', column1='partner_id',
                                    column2='category_id', string='Tags', default=_default_category)
    credit_limit = fields.Float(string='Credit Limit')
    barcode = fields.Char(oldname='ean13')
    employee = fields.Boolean(help="Check this box if this contact is an Employee.")
    function = fields.Char(string='Job Position')
    color = fields.Integer(string='Color Index', default=0)
    industry_id = fields.Many2one('res.partner.industry', 'Industry')
    commercial_partner_id = fields.Many2one('res.partner', compute='_compute_commercial_partner',
                                             string='Commercial Entity', store=True, index=True)
    commercial_company_name = fields.Char('Company Name Entity', compute='_compute_commercial_company_name',
                                          store=True)
    partner_share = fields.Boolean(
        'Share Partner', compute='_compute_partner_share', store=True,
        help="Either customer (not a user), either shared user. Indicated the current partner is a customer without "
             "access or with a limited access created for sharing data.")
    type = fields.Selection(selection_add=[
         ('invoice', 'Invoice address'),
         ('delivery', 'Shipping address'),
         ('other', 'Other address'),
         ("private", "Private Address")])

    # technical field used for managing commercial fields

    @api.depends('tz')
    def _compute_tz_offset(self):
        for partner in self:
            partner.tz_offset = datetime.datetime.now(pytz.timezone(partner.tz or 'GMT')).strftime('%z')

    @api.depends('user_ids.share')
    def _compute_partner_share(self):
        for partner in self:
            partner.partner_share = not partner.user_ids or any(user.share for user in partner.user_ids)

    @api.depends('is_company', 'parent_id.commercial_partner_id')
    def _compute_commercial_partner(self):
        for partner in self:
            if partner.is_company or not partner.parent_id:
                partner.commercial_partner_id = partner
            else:
                partner.commercial_partner_id = partner.parent_id.commercial_partner_id

    @api.depends('company_name', 'parent_id.is_company', 'commercial_partner_id.name')
    def _compute_commercial_company_name(self):
        for partner in self:
            p = partner.commercial_partner_id
            partner.commercial_company_name = p.is_company and p.name or partner.company_name

    @api.multi
    def open_commercial_entity(self):
        """ Utility method used to add an "Open Company" button in partner views """
        self.ensure_one()
        return {'type': 'ir.actions.act_window',
                'res_model': 'res.partner',
                'view_mode': 'form',
                'res_id': self.commercial_partner_id.id,
                'target': 'current',
                'flags': {'form': {'action_buttons': True}}}

    @api.model
    def _get_default_image(self, partner_type, is_company, parent_id):
        img_path, image = False, False
        res = super(Partner, self)._get_default_image(partner_type, is_company, parent_id)
        if partner_type in ['other'] and parent_id:
            parent_image = self.browse(parent_id).image
            image = parent_image and base64.b64decode(parent_image) or None

        if not image and partner_type == 'invoice':
            img_path = get_module_resource('base', 'static/img', 'money.png')
        elif not image and partner_type == 'delivery':
            img_path = get_module_resource('base', 'static/img', 'truck.png')
        if img_path:
            with open(img_path, 'rb') as f:
                image = f.read()
        if image:
            return tools.image_resize_image_big(base64.b64encode(image))
        return res

    @api.model
    def _name_search(self, name, args=None, operator='ilike', limit=100, name_get_uid=None):
        self = self.sudo(name_get_uid or self.env.uid)
        if args is None:
            args = []
        if name and operator in ('=', 'ilike', '=ilike', 'like', '=like'):
            self.check_access_rights('read')
            where_query = self._where_calc(args)
            self._apply_ir_rules(where_query, 'read')
            from_clause, where_clause, where_clause_params = where_query.get_sql()
            where_str = where_clause and (" WHERE %s AND " % where_clause) or ' WHERE '

            # search on the name of the contacts and of its company
            search_name = name
            if operator in ('ilike', 'like'):
                search_name = '%%%s%%' % name
            if operator in ('=ilike', '=like'):
                operator = operator[1:]

            unaccent = get_unaccent_wrapper(self.env.cr)

            query = """SELECT id
                         FROM res_partner
                      {where} ({email} {operator} {percent}
                           OR {display_name} {operator} {percent}
                           OR {reference} {operator} {percent}
                           OR {vat} {operator} {percent})
                           -- don't panic, trust postgres bitmap
                     ORDER BY {display_name} {operator} {percent} desc,
                              {display_name}
                    """.format(where=where_str,
                               operator=operator,
                               email=unaccent('email'),
                               display_name=unaccent('display_name'),
                               reference=unaccent('ref'),
                               percent=unaccent('%s'),
                               vat=unaccent('vat'),)
            where_clause_params += [search_name] * 5
            if limit:
                query += ' limit %s'
                where_clause_params.append(limit)
            self.env.cr.execute(query, where_clause_params)
            partner_ids = [row[0] for row in self.env.cr.fetchall()]
            if partner_ids:
                return self.browse(partner_ids).name_get()
            else:
                return []
        return super(Partner, self)._name_search(name, args, operator=operator, limit=limit, name_get_uid=name_get_uid)

    @api.multi
    def name_get(self):
        for partner in self:
            name = partner.name or ''
            if partner.company_name or partner.parent_id:
                if not name and partner.type in ['invoice', 'delivery', 'other']:
                    name = dict(self.fields_get(['type'])['type']['selection'])[partner.type]
                if not partner.is_company:
                    name = "%s, %s" % (partner.commercial_company_name or partner.parent_id.name, name)
        return super(Partner, self).name_get()

    @api.model
    def view_header_get(self, view_id, view_type):
        res = super(Partner, self).view_header_get(view_id, view_type)
        if res: return res
        if not self._context.get('category_id'):
            return False
        return _('Partners: ') + self.env['res.partner.category'].browse(self._context['category_id']).name

    @api.model
    def _commercial_fields(self):
        """ Returns the list of fields that are managed by the commercial entity
        to which a partner belongs. These fields are meant to be hidden on
        partners that aren't `commercial entities` themselves, and will be
        delegated to the parent `commercial entity`. The list is meant to be
        extended by inheriting classes. """
        return ['vat', 'credit_limit']

    @api.multi
    def _commercial_sync_from_company(self):
        """ Handle sync of commercial fields when a new parent commercial entity is set,
        as if they were related fields """
        commercial_partner = self.commercial_partner_id
        if commercial_partner != self:
            sync_vals = commercial_partner._update_fields_values(self._commercial_fields())
            self.write(sync_vals)

    @api.multi
    def _commercial_sync_to_children(self):
        """ Handle sync of commercial fields to descendants """
        commercial_partner = self.commercial_partner_id
        sync_vals = commercial_partner._update_fields_values(self._commercial_fields())
        sync_children = self.child_ids.filtered(lambda c: not c.is_company)
        for child in sync_children:
            child._commercial_sync_to_children()
        sync_children._compute_commercial_partner()
        return sync_children.write(sync_vals)

    @api.multi
    def _fields_sync(self, values):
        if values.get('parent_id') or values.get('type', 'contact'):
            # 1a. Commercial fields: sync if parent changed
            if values.get('parent_id'):
                self._commercial_sync_from_company()
        if self.child_ids:
            # 2a. Commercial Fields: sync if commercial entity
            if self.commercial_partner_id == self:
                commercial_fields = self._commercial_fields()
                if any(field in values for field in commercial_fields):
                    self._commercial_sync_to_children()
            for child in self.child_ids.filtered(lambda c: not c.is_company):
                if child.commercial_partner_id != self.commercial_partner_id :
                    self._commercial_sync_to_children()
                    break
        return super(Partner, self)._fields_sync(values)

    @api.multi
    def _display_address(self, without_company=False):
        address = super(Partner, self)._display_address(without_company)
        if self.commercial_company_name and not without_company:
            address = '%(company_name)s\n' % self.commercial_company_name + address
        return address


class ResPartnerIndustry(models.Model):
    _description = 'Industry'
    _name = "res.partner.industry"
    _order = "name"

    name = fields.Char('Name', translate=True)
    full_name = fields.Char('Full Name', translate=True)
    active = fields.Boolean('Active', default=True)
