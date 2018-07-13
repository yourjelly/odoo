# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime
import pytz
from lxml import etree
from email.utils import formataddr
from werkzeug import urls

from odoo import api, fields, models, tools, SUPERUSER_ID, _
from odoo.exceptions import UserError, ValidationError

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

    @api.constrains('parent_id')
    def _check_parent_id(self):
        if not self._check_recursion():
            raise ValidationError(_('You can not create recursive tags.'))

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
    vat = fields.Char(string='TIN', help="Tax Identification Number. "
                                         "Fill it if the company is subjected to taxes. "
                                         "Used by the some of the legal statements.")
    website = fields.Char(help="Website of Partner or Company")
    comment = fields.Text(string='Notes')
    bank_ids = fields.One2many('res.partner.bank', 'partner_id', string='Banks')
    category_id = fields.Many2many('res.partner.category', column1='partner_id',
                                    column2='category_id', string='Tags', default=_default_category)
    credit_limit = fields.Float(string='Credit Limit')
    barcode = fields.Char(oldname='ean13')
    employee = fields.Boolean(help="Check this box if this contact is an Employee.")
    function = fields.Char(string='Job Position')
    phone = fields.Char()
    mobile = fields.Char()
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

    # technical field used for managing commercial fields

    @api.depends('tz')
    def _compute_tz_offset(self):
        for partner in self:
            partner.tz_offset = datetime.datetime.now(pytz.timezone(partner.tz or 'GMT')).strftime('%z')

    @api.depends('user_ids.share')
    def _compute_partner_share(self):
        for partner in self:
            partner.partner_share = not partner.user_ids or any(user.share for user in partner.user_ids)

    def _clean_website(self, website):
        url = urls.url_parse(website)
        if not url.scheme:
            if not url.netloc:
                url = url.replace(netloc=url.path, path='')
            website = url.replace(scheme='http').to_url()
        return website

    @api.multi
    def write(self, vals):
        if vals.get('website'):
            vals['website'] = self._clean_website(vals['website'])
        return super(Partner, self).write(vals)

    @api.multi
    def create(self, vals):
        if vals.get('website'):
            vals['website'] = self._clean_website(vals['website'])
        return super(Partner, self).create(vals)

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

    @api.constrains('parent_id')
    def _check_parent_id(self):
        if not self._check_recursion():
            raise ValidationError(_('You cannot create recursive Partner hierarchies.'))

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
        """ Sync commercial fields and address fields from company and to children after create/update,
        just as if those were all modeled as fields.related to the parent """
        # 1. From UPSTREAM: sync from parent
        if values.get('parent_id') or values.get('type', 'contact'):
            # 1a. Commercial fields: sync if parent changed
            if values.get('parent_id'):
                self._commercial_sync_from_company()
        return super(Partner, self)._fields_sync(values)

class ResPartnerIndustry(models.Model):
    _description = 'Industry'
    _name = "res.partner.industry"
    _order = "name"

    name = fields.Char('Name', translate=True)
    full_name = fields.Char('Full Name', translate=True)
    active = fields.Boolean('Active', default=True)
