# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from __future__ import annotations

import binascii
import contextlib
import collections
import datetime
import hmac
import ipaddress
import json
import logging
import os
import time
from functools import wraps
from hashlib import sha256
from itertools import chain, repeat
from markupsafe import Markup

import pytz
from lxml.builder import E
from passlib.context import CryptContext as _CryptContext

from odoo import api, fields, models, tools, SUPERUSER_ID, _, Command
from odoo.exceptions import AccessDenied, AccessError, UserError, ValidationError
from odoo.http import request, DEFAULT_LANG
from odoo.osv import expression
from odoo.tools import is_html_empty, frozendict, lazy_property, SQL, SetDefinitions, Query

_logger = logging.getLogger(__name__)

class CryptContext:
    def __init__(self, *args, **kwargs):
        self.__obj__ = _CryptContext(*args, **kwargs)

    def copy(self):
        """
            The copy method must create a new instance of the
            ``CryptContext`` wrapper with the same configuration
            as the original (``__obj__``).

            There are no need to manage the case where kwargs are
            passed to the ``copy`` method.

            It is necessary to load the original ``CryptContext`` in
            the new instance of the original ``CryptContext`` with ``load``
            to get the same configuration.
        """
        other_wrapper = CryptContext(_autoload=False)
        other_wrapper.__obj__.load(self.__obj__)
        return other_wrapper

    @property
    def hash(self):
        return self.__obj__.hash

    @property
    def identify(self):
        return self.__obj__.identify

    @property
    def verify(self):
        return self.__obj__.verify

    @property
    def verify_and_update(self):
        return self.__obj__.verify_and_update

    def schemes(self):
        return self.__obj__.schemes()

    def update(self, **kwargs):
        if kwargs.get("schemes"):
            assert isinstance(kwargs["schemes"], str) or all(isinstance(s, str) for s in kwargs["schemes"])
        return self.__obj__.update(**kwargs)


# Only users who can modify the user (incl. the user herself) see the real contents of these fields
USER_PRIVATE_FIELDS = []
MIN_ROUNDS = 600_000
concat = chain.from_iterable

def _jsonable(o):
    try: json.dumps(o)
    except TypeError: return False
    else: return True

def check_identity(fn):
    """ Wrapped method should be an *action method* (called from a button
    type=object), and requires extra security to be executed. This decorator
    checks if the identity (password) has been checked in the last 10mn, and
    pops up an identity check wizard if not.

    Prevents access outside of interactive contexts (aka with a request)
    """
    @wraps(fn)
    def wrapped(self, *args, **kwargs):
        if not request:
            raise UserError(_("This method can only be accessed over HTTP"))

        if request.session.get('identity-check-last', 0) > time.time() - 10 * 60:
            # update identity-check-last like github?
            return fn(self, *args, **kwargs)

        w = self.sudo().env['res.users.identitycheck'].create({
            'request': json.dumps([
                { # strip non-jsonable keys (e.g. mapped to recordsets)
                    k: v for k, v in self.env.context.items()
                    if _jsonable(v)
                },
                self._name,
                self.ids,
                fn.__name__,
                args,
                kwargs
            ])
        })
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'res.users.identitycheck',
            'res_id': w.id,
            'name': _("Security Control"),
            'target': 'new',
            'views': [(False, 'form')],
        }
    wrapped.__has_check_identity = True
    return wrapped

#----------------------------------------------------------
# Basic res.groups and res.users
#----------------------------------------------------------


class ResGroups(models.Model):
    _name = 'res.groups'
    _description = "Access Groups"
    _rec_name = 'full_name'
    _order = 'name'
    _allow_sudo_commands = False

    name = fields.Char(required=True, translate=True)
    user_ids = fields.Many2many('res.users', 'res_groups_users_rel', 'gid', 'uid', help='Users with this group specifically')
    all_user_ids = fields.Many2many('res.users', compute='_compute_all_user_ids', compute_sudo=True, search='_search_all_user_ids', string='Users and implied users')

    model_access = fields.One2many('ir.model.access', 'group_id', string='Access Controls', copy=True)
    rule_groups = fields.Many2many('ir.rule', 'rule_group_rel',
        'group_id', 'rule_group_id', string='Rules', domain="[('global', '=', False)]")
    menu_access = fields.Many2many('ir.ui.menu', 'ir_ui_menu_group_rel', 'gid', 'menu_id', string='Access Menu')
    view_access = fields.Many2many('ir.ui.view', 'ir_ui_view_group_rel', 'group_id', 'view_id', string='Views')
    comment = fields.Text(translate=True)
    category_id = fields.Many2one('ir.module.category', string='Application', index=True)
    visible = fields.Boolean(related='category_id.visible', readonly=True)
    color = fields.Integer(string='Color Index')
    full_name = fields.Char(compute='_compute_full_name', string='Group Name', search='_search_full_name')
    share = fields.Boolean(string='Share Group', help="Group created to set access rights for sharing data with some users.")
    api_key_duration = fields.Float(string='API Keys maximum duration days',
        help="Determines the maximum duration of an api key created by a user belonging to this group.")

    _name_uniq = models.Constraint("UNIQUE (category_id, name)",
        'The name of the group must be unique within an application!')
    _check_api_key_duration = models.Constraint(
        'CHECK(api_key_duration >= 0)',
        'The api key duration cannot be a negative value.',
    )

    """ The groups involved are to be interpreted as sets.
    Thus we can define groups that we will call for example N, Z... such as mathematical sets.
        ┌──────────────────────────────────────────┐
        │ C  ┌──────────────────────────┐          │
        │    │ R  ┌───────────────────┐ │ ┌──────┐ |   "C"
        │    │    │ Q  ┌────────────┐ │ │ │ I    | |   "I" implied "C"
        │    │    │    │ Z  ┌─────┐ │ │ │ │      | |   "R" implied "C"
        │    │    │    │    │ N   │ │ │ │ │      │ │   "Q" implied "R"
        │    │    │    │    └─────┘ │ │ │ │      │ │   "P" implied "R"
        │    │    │    └────────────┘ │ │ │      │ │   "Z" implied "Q"
        │    │    └───────────────────┘ │ │      │ │   "N" implied "Z"
        │    │      ┌───────────────┐   │ │      │ │
        │    │      │ P             │   │ │      │ │
        │    │      └───────────────┘   │ └──────┘ │
        │    └──────────────────────────┘          │
        └──────────────────────────────────────────┘
    For example:
    * A manager group will imply a user group: all managers are users;
    * A group "computer developer employee" will imply that he is an employee group, a user group,
      that he has access to the timesheet user group....
    """
    implied_ids = fields.Many2many('res.groups', 'res_groups_implied_rel', 'gid', 'hid',
        string='Inherits', help='Users of this group are also implicitely part of these inherited groups')
    all_implied_ids = fields.Many2many('res.groups', string='Transitive and recursive closure', recursive=True,
        compute='_compute_all_implied_ids', compute_sudo=True, search='_search_all_implied_ids')
    implied_by_ids = fields.Many2many('res.groups', 'res_groups_implied_rel', 'hid', 'gid', string='Automatically added from')
    all_implied_by_ids = fields.Many2many('res.groups', string='Reversed transitive and recursive closure', recursive=True,
        compute='_compute_all_implied_by_ids', compute_sudo=True, search='_search_all_implied_by_ids')

    disjoint_ids = fields.Many2many('res.groups', string='Disjoint groups',
        help="It is not possible to have disjoint groups on the same user (eg: The user will only be able to have one of these 3 disjoint groups: user, public or portal).",
        compute='_compute_disjoint_ids')

    @api.constrains('implied_ids', 'implied_by_ids', 'user_ids')
    def _check_disjoint_groups(self):
        self.env.registry.clear_cache('groups')
        # Check users in all groups implying this one
        (self + self.search([('all_implied_ids', 'in', self.ids)])).user_ids._check_disjoint_groups()

    @api.ondelete(at_uninstall=False)
    def _unlink_except_settings_group(self):
        classified = self.env['res.config.settings']._get_classified_fields()
        for _name, _groups, implied_group in classified['group']:
            if implied_group.id in self.ids:
                raise ValidationError(_('You cannot delete a group linked with a settings field.'))

    @api.depends('category_id.name', 'name')
    def _compute_full_name(self):
        # Important: value must be stored in environment of group, not group1!
        for group, group1 in zip(self, self.sudo()):
            if group1.category_id:
                group.full_name = '%s / %s' % (group1.category_id.name, group1.name)
            else:
                group.full_name = group1.name

    def _search_full_name(self, operator, operand):
        lst = True
        if isinstance(operand, bool):
            return [('name', operator, operand)]
        if isinstance(operand, str):
            lst = False
            operand = [operand]
        where_domains = []
        for group in operand:
            values = [v for v in group.split('/') if v]
            group_name = values.pop().strip()
            category_name = values and '/'.join(values).strip() or group_name
            group_domain = [('name', operator, lst and [group_name] or group_name)]
            category_ids = self.env['ir.module.category'].sudo()._search(
                [('name', operator, [category_name] if lst else category_name)])
            category_domain = [('category_id', 'in', category_ids)]
            if operator in expression.NEGATIVE_TERM_OPERATORS and not values:
                category_domain = expression.OR([category_domain, [('category_id', '=', False)]])
            if (operator in expression.NEGATIVE_TERM_OPERATORS) == (not values):
                where = expression.AND([group_domain, category_domain])
            else:
                where = expression.OR([group_domain, category_domain])
            where_domains.append(where)
        if operator in expression.NEGATIVE_TERM_OPERATORS:
            return expression.AND(where_domains)
        else:
            return expression.OR(where_domains)

    @api.model
    def _search(self, domain, offset=0, limit=None, order=None):
        # add explicit ordering if search is sorted on full_name
        if order and order.startswith('full_name'):
            groups = super().search(domain)
            groups = groups.sorted('full_name', reverse=order.endswith('DESC'))
            groups = groups[offset:offset+limit] if limit else groups[offset:]
            return groups._as_query(order)
        return super()._search(domain, offset, limit, order)

    def copy_data(self, default=None):
        default = dict(default or {})
        vals_list = super().copy_data(default=default)
        for group, vals in zip(self, vals_list):
            vals['name'] = default.get('name') or _('%s (copy)', group.name)
        return vals_list

    def write(self, vals):
        if 'name' in vals:
            if vals['name'].startswith('-'):
                raise UserError(_('The name of the group can not start with "-"'))

        # invalidate caches before updating groups, since the recomputation of
        # field 'share' depends on method has_group()
        # DLE P139
        if self.ids:
            self.env['ir.model.access'].call_cache_clearing_methods()

        res = super().write(vals)

        if 'implied_ids' in vals or 'implied_by_ids' in vals:
            # Invalid group_definitions representing the set of groups and their relationships
            self.env.registry.clear_cache('groups')

        return res

    def _ensure_xml_id(self):
        """Return the groups external identifiers, creating the external identifier for groups missing one"""
        result = self.get_external_id()
        missings = {group_id: f'__custom__.group_{group_id}' for group_id, ext_id in result.items() if not ext_id}
        if missings:
            self.env['ir.model.data'].sudo().create(
                [
                    {
                        'name': name.split('.')[1],
                        'model': 'res.groups',
                        'res_id': group_id,
                        'module': name.split('.')[0],
                    }
                    for group_id, name in missings.items()
                ]
            )
            result.update(missings)

        return result

    @api.depends('implied_ids.all_implied_ids')
    def _compute_all_implied_ids(self):
        """
        Compute the transitive closure recursively and reflexible.
        """
        group_definitions = self._get_group_definitions()
        for g in self:
            g.all_implied_ids = g.ids + list(group_definitions.get_superset_ids(g.ids))

    def _search_all_implied_ids(self, operator, value):
        """
        Compute the search on the transitive closure recursively and reflexible.
        """
        assert isinstance(value, (int, list, tuple))
        if isinstance(value, int):
            value = [value]
        group_definitions = self._get_group_definitions()
        ids = [*value, *group_definitions.get_subset_ids(value)]
        return [('id', operator, ids)]

    @api.depends('implied_by_ids.all_implied_by_ids')
    def _compute_all_implied_by_ids(self):
        """
        Compute the reversed transitive closure recursively and reflexible.
        """
        group_definitions = self._get_group_definitions()
        for g in self:
            g.all_implied_by_ids = g.ids + list(group_definitions.get_subset_ids(g.ids))

    def _search_all_implied_by_ids(self, operator, value):
        """
        Compute the search on the reversed transitive closure recursively and reflexible.
        """
        assert isinstance(value, (int, list, tuple, Query))
        if isinstance(value, int):
            value = [value]
        group_definitions = self._get_group_definitions()
        ids = [*value, *group_definitions.get_superset_ids(value)]
        return [('id', operator, ids)]

    def _compute_disjoint_ids(self):
        self.disjoint_ids = False
        # determine exclusive groups (will be disjoint for the set expression)
        user_types_category_id = self.env['ir.model.data']._xmlid_to_res_id('base.module_category_user_type', raise_if_not_found=False)
        if user_types_category_id:
            user_type_ids = self.sudo().search([('category_id', '=', user_types_category_id)])
            for g in self:
                if g in user_type_ids:
                    g.disjoint_ids = user_type_ids - g

    @api.depends('all_implied_by_ids.user_ids')
    def _compute_all_user_ids(self):
        for g in self:
            g.all_user_ids = g.all_implied_by_ids.user_ids

    def _search_all_user_ids(self, operator, operand):
        return [('all_implied_by_ids.user_ids', operator, operand)]

    @api.model_create_multi
    def create(self, vals_list):
        user_ids_list = [vals.pop('user_ids', None) for vals in vals_list]
        groups = super().create(vals_list)
        for group, user_ids in zip(groups, user_ids_list):
            if user_ids:
                # delegate addition of users to add implied groups
                group.write({'user_ids': user_ids})
        self.env.registry.clear_cache('groups')
        return groups

    def unlink(self):
        res = super().unlink()
        self.env.registry.clear_cache('groups')
        return res

    def _apply_group(self, implied_group):
        """ Add the given group to the groups implied by the current group
        :param implied_group: the implied group to add
        """
        groups = self.filtered(lambda g: implied_group not in g.all_implied_ids)
        groups.write({'implied_ids': [Command.link(implied_group.id)]})

    def _remove_group(self, implied_group):
        """ Remove the given group from the implied groups of the current group
        :param implied_group: the implied group to remove
        """
        groups = self.all_implied_ids.filtered(lambda g: implied_group in g.implied_ids)
        groups.write({'implied_ids': [Command.unlink(implied_group.id)]})

    @api.model
    @tools.ormcache(cache='groups')
    def _get_group_definitions(self):
        """ Return the definition of all the groups as a :class:`~odoo.tools.SetDefinitions`. """
        groups = self.sudo().search([], order='id')
        id_to_ref = groups.get_external_id()
        data = {
            group.id: {
                'ref': id_to_ref[group.id] or str(group.id),
                'supersets': group.implied_ids.ids,
                'disjoints': group.disjoint_ids.ids,
            }
            for group in groups
        }
        return SetDefinitions(data)


class ResUsersLog(models.Model):
    _name = 'res.users.log'
    _order = 'id desc'
    _description = 'Users Log'
    # Uses the magical fields `create_uid` and `create_date` for recording logins.
    # See `bus.presence` for more recent activity tracking purposes.

    @api.autovacuum
    def _gc_user_logs(self):
        self._cr.execute("""
            DELETE FROM res_users_log log1 WHERE EXISTS (
                SELECT 1 FROM res_users_log log2
                WHERE log1.create_uid = log2.create_uid
                AND log1.create_date < log2.create_date
            )
        """)
        _logger.info("GC'd %d user log entries", self._cr.rowcount)


class ResUsers(models.Model):
    """ User class. A res.users record models an OpenERP user and is different
        from an employee.

        res.users class now inherits from res.partner. The partner model is
        used to store the data related to the partner: lang, name, address,
        avatar, ... The user model is now dedicated to technical data.
    """
    _description = 'User'
    _inherits = {'res.partner': 'partner_id'}
    _order = 'name, login'
    _allow_sudo_commands = False

    def _check_company_domain(self, companies):
        if not companies:
            return []
        company_ids = companies if isinstance(companies, str) else models.to_record_ids(companies)
        return [('company_ids', 'in', company_ids)]

    @property
    def SELF_READABLE_FIELDS(self):
        """ The list of fields a user can read on their own user record.
        In order to add fields, please override this property on model extensions.
        """
        return [
            'signature', 'company_id', 'login', 'email', 'name', 'image_1920',
            'image_1024', 'image_512', 'image_256', 'image_128', 'lang', 'tz',
            'tz_offset', 'group_ids', 'partner_id', 'write_date', 'action_id',
            'avatar_1920', 'avatar_1024', 'avatar_512', 'avatar_256', 'avatar_128',
            'share', 'device_ids',
        ]

    @property
    def SELF_WRITEABLE_FIELDS(self):
        """ The list of fields a user can write on their own user record.
        In order to add fields, please override this property on model extensions.
        """
        return ['signature', 'action_id', 'company_id', 'email', 'name', 'image_1920', 'lang', 'tz']

    def _default_groups(self):
        """Default groups for employees

        All the groups of the Template User
        """
        default_user = self.env.ref('base.default_user', raise_if_not_found=False)
        return default_user.sudo().group_ids if default_user else []

    partner_id = fields.Many2one('res.partner', required=True, ondelete='restrict', auto_join=True, index=True,
        string='Related Partner', help='Partner-related data of the user')
    login = fields.Char(required=True, help="Used to log into the system")
    password = fields.Char(
        compute='_compute_password', inverse='_set_password', copy=False,
        help="Keep empty if you don't want the user to be able to connect on the system.")
    new_password = fields.Char(string='Set Password',
        compute='_compute_password', inverse='_set_new_password',
        help="Specify a value only when creating a user or if you're "\
             "changing the user's password, otherwise leave empty. After "\
             "a change of password, the user has to login again.")
    signature = fields.Html(string="Email Signature", compute='_compute_signature', readonly=False, store=True)
    active = fields.Boolean(default=True)
    active_partner = fields.Boolean(related='partner_id.active', readonly=True, string="Partner is Active")
    action_id = fields.Many2one('ir.actions.actions', string='Home Action',
        help="If specified, this action will be opened at log on for this user, in addition to the standard menu.")
    log_ids = fields.One2many('res.users.log', 'create_uid', string='User log entries')
    device_ids = fields.One2many('res.device', 'user_id', string='User devices')
    login_date = fields.Datetime(related='log_ids.create_date', string='Latest authentication', readonly=False)
    share = fields.Boolean(compute='_compute_share', compute_sudo=True, string='Share User', store=True,
         help="External user with limited access, created only for the purpose of sharing data.")
    companies_count = fields.Integer(compute='_compute_companies_count', string="Number of Companies")
    tz_offset = fields.Char(compute='_compute_tz_offset', string='Timezone offset')
    res_users_settings_ids = fields.One2many('res.users.settings', 'user_id')
    # Provide a target for relateds that is not a x2Many field.
    res_users_settings_id = fields.Many2one('res.users.settings', string="Settings", compute='_compute_res_users_settings_id', search='_search_res_users_settings_id')

    # Special behavior for this field: res.company.search() will only return the companies
    # available to the current user (should be the user's companies?), when the user_preference
    # context is set.
    company_id = fields.Many2one('res.company', string='Company', required=True, default=lambda self: self.env.company.id,
        help='The default company for this user.', context={'user_preference': True})
    company_ids = fields.Many2many('res.company', 'res_company_users_rel', 'user_id', 'cid',
        string='Companies', default=lambda self: self.env.company.ids)

    # overridden inherited fields to bypass access rights, in case you have
    # access to the user but not its corresponding partner
    name = fields.Char(related='partner_id.name', inherited=True, readonly=False)
    email = fields.Char(related='partner_id.email', inherited=True, readonly=False)

    group_ids = fields.Many2many('res.groups', 'res_groups_users_rel', 'uid', 'gid', string='Groups', default=lambda s: s._default_groups(), help="Group added directly to this user")
    all_group_ids = fields.Many2many('res.groups', compute='_compute_all_group_ids', compute_sudo=True, search='_search_all_group_ids', string="Groups and implied groups")
    view_visible_implied_group_ids = fields.Many2many('res.groups', compute='_compute_view_implied_group_ids', string="Groups added automatically")
    view_disjoint_group_ids = fields.Many2many('res.groups', compute='_compute_view_implied_group_ids', string="Disjoint groups")
    view_all_disjoint_group_ids = fields.Many2many('res.groups', compute='_compute_view_implied_group_ids', string="All disjoint groups")
    view_show_technical_groups = fields.Boolean(string="Show technical groups", store=False)

    accesses_count = fields.Integer('# Access Rights', help='Number of access rights that apply to the current user',
                                    compute='_compute_accesses_count', compute_sudo=True)
    rules_count = fields.Integer('# Record Rules', help='Number of record rules that apply to the current user',
                                 compute='_compute_accesses_count', compute_sudo=True)
    groups_count = fields.Integer('# Groups', help='Number of groups that apply to the current user',
                                  compute='_compute_accesses_count', compute_sudo=True)

    _login_key = models.Constraint("UNIQUE (login)",
        'You can not have two users with the same login!')

    def init(self):
        cr = self.env.cr

        # allow setting plaintext passwords via SQL and have them
        # automatically encrypted at startup: look for passwords which don't
        # match the "extended" MCF and pass those through passlib.
        # Alternative: iterate on *all* passwords and use CryptContext.identify
        cr.execute(r"""
        SELECT id, password FROM res_users
        WHERE password IS NOT NULL
          AND password !~ '^\$[^$]+\$[^$]+\$.'
        """)
        if self.env.cr.rowcount:
            ResUsers = self.sudo()
            for uid, pw in cr.fetchall():
                ResUsers.browse(uid).password = pw

    def _set_password(self):
        ctx = self._crypt_context()
        for user in self:
            self._set_encrypted_password(user.id, ctx.hash(user.password))

    def _set_encrypted_password(self, uid, pw):
        assert self._crypt_context().identify(pw) != 'plaintext'

        self.env.cr.execute(
            'UPDATE res_users SET password=%s WHERE id=%s',
            (pw, uid)
        )
        self.browse(uid).invalidate_recordset(['password'])

    def _check_credentials(self, credential, env):
        """ Validates the current user's password.

        Override this method to plug additional authentication methods.

        Overrides should:

        * call `super` to delegate to parents for credentials-checking
        * catch AccessDenied and perform their own checking
        * (re)raise AccessDenied if the credentials are still invalid
          according to their own validation method
        * return the auth_info

        When trying to check for credentials validity, call _check_credentials
        instead.

        Credentials are considered to be untrusted user input, for more information please check :func:`~.authenticate`

        :returns: auth_info dictionary containing:
          - uid: the uid of the authenticated user
          - auth_method: which method was used during authentication
          - mfa: whether mfa should be skipped or not, possible values:
            - enforce: enforce mfa no matter what (not yet implemented)
            - default: delegate to auth_totp
            - skip: skip mfa no matter what
          Examples:
          - { 'uid': 20, 'auth_method': 'password',      'mfa': 'default' }
          - { 'uid': 17, 'auth_method': 'impersonation', 'mfa': 'enforce' }
          - { 'uid': 32, 'auth_method': 'webauthn',      'mfa': 'skip'    }
        :rtype: dict
        """
        if not (credential['type'] == 'password' and credential['password']):
            raise AccessDenied()
        self.env.cr.execute(
            "SELECT COALESCE(password, '') FROM res_users WHERE id=%s",
            [self.env.user.id]
        )
        [hashed] = self.env.cr.fetchone()
        valid, replacement = self._crypt_context()\
            .verify_and_update(credential['password'], hashed)
        if replacement is not None:
            self._set_encrypted_password(self.env.user.id, replacement)
            if request and self == self.env.user:
                self.env.flush_all()
                self.env.registry.clear_cache()
                # update session token so the user does not get logged out
                new_token = self.env.user._compute_session_token(request.session.sid)
                request.session.session_token = new_token

        if not valid:
            raise AccessDenied()
        return {
            'uid': self.env.user.id,
            'auth_method': 'password',
            'mfa': 'default',
        }

    def _compute_password(self):
        for user in self:
            user.password = ''
            user.new_password = ''

    def _set_new_password(self):
        for user in self:
            if not user.new_password:
                # Do not update the password if no value is provided, ignore silently.
                # For example web client submits False values for all empty fields.
                continue
            if user == self.env.user:
                # To change their own password, users must use the client-specific change password wizard,
                # so that the new password is immediately used for further RPC requests, otherwise the user
                # will face unexpected 'Access Denied' exceptions.
                raise UserError(_('Please use the change password wizard (in User Preferences or User menu) to change your own password.'))
            else:
                user.password = user.new_password

    @api.depends('name')
    def _compute_signature(self):
        for user in self.filtered(lambda user: user.name and is_html_empty(user.signature)):
            user.signature = Markup('<p>--<br />%s</p>') % user['name']

    @api.depends('group_ids.all_implied_ids')
    def _compute_all_group_ids(self):
        for user in self:
            user.all_group_ids = user.group_ids.all_implied_ids

    def _search_all_group_ids(self, operator, operand):
        return [('group_ids.all_implied_ids', operator, operand)]

    @api.depends('group_ids.all_implied_ids', 'view_show_technical_groups')
    def _compute_view_implied_group_ids(self):
        group_definitions = self.env['res.groups']._get_group_definitions()
        for user in self:
            user.view_disjoint_group_ids = user.all_group_ids.disjoint_ids.ids
            user.view_all_disjoint_group_ids = list(group_definitions.get_disjoint_ids(user.all_group_ids.ids))
            user.view_visible_implied_group_ids = user.group_ids.implied_ids.all_implied_ids
            if not user.view_show_technical_groups:
                user.view_visible_implied_group_ids = user.view_visible_implied_group_ids.filtered(lambda g: g.category_id.visible)

    @api.depends('all_group_ids')
    def _compute_share(self):
        user_group_id = self.env['ir.model.data']._xmlid_to_res_id('base.group_user')
        internal_users = self.filtered_domain([('all_group_ids', 'in', [user_group_id])])
        internal_users.share = False
        (self - internal_users).share = True

    @api.depends('company_id')
    def _compute_companies_count(self):
        self.companies_count = self.env['res.company'].sudo().search_count([])

    @api.depends('tz')
    def _compute_tz_offset(self):
        for user in self:
            user.tz_offset = datetime.datetime.now(pytz.timezone(user.tz or 'GMT')).strftime('%z')

    @api.depends('all_group_ids')
    def _compute_accesses_count(self):
        for user in self:
            groups = user.all_group_ids
            user.accesses_count = len(groups.model_access)
            user.rules_count = len(groups.rule_groups)
            user.groups_count = len(groups)

    @api.depends('res_users_settings_ids')
    def _compute_res_users_settings_id(self):
        for user in self:
            user.res_users_settings_id = user.res_users_settings_ids and user.res_users_settings_ids[0]

    @api.model
    def _search_res_users_settings_id(self, operator, operand):
        return [('res_users_settings_ids', operator, operand)]

    @api.onchange('login')
    def on_change_login(self):
        if self.login and tools.single_email_re.match(self.login):
            self.email = self.login

    @api.onchange('parent_id')
    def onchange_parent_id(self):
        return self.partner_id.onchange_parent_id()

    def _fetch_query(self, query, fields):
        records = super()._fetch_query(query, fields)
        if not set(USER_PRIVATE_FIELDS).isdisjoint(field.name for field in fields):
            if self.browse().has_access('write'):
                return records
            for fname in USER_PRIVATE_FIELDS:
                self.env.cache.update(records, self._fields[fname], repeat('********'))
        return records

    @api.constrains('company_id', 'company_ids', 'active')
    def _check_company(self):
        for user in self.filtered(lambda u: u.active):
            if user.company_id not in user.company_ids:
                raise ValidationError(
                    _('Company %(company_name)s is not in the allowed companies for user %(user_name)s (%(company_allowed)s).',
                      company_name=user.company_id.name,
                      user_name=user.name,
                      company_allowed=', '.join(user.mapped('company_ids.name')))
                )

    @api.constrains('action_id')
    def _check_action_id(self):
        action_open_website = self.env.ref('base.action_open_website', raise_if_not_found=False)
        if action_open_website and any(user.action_id.id == action_open_website.id for user in self):
            raise ValidationError(_('The "App Switcher" action cannot be selected as home action.'))
        # We use sudo() because  "Access rights" admins can't read action models
        for user in self.sudo():
            if user.action_id.type == "ir.actions.client":
                # Prevent using reload actions.
                action = self.env["ir.actions.client"].browse(user.action_id.id)  # magic
                if action.tag == "reload":
                    raise ValidationError(_('The "%s" action cannot be selected as home action.', action.name))

            elif user.action_id.type == "ir.actions.act_window":
                # Restrict actions that include 'active_id' in their context.
                action = self.env["ir.actions.act_window"].browse(user.action_id.id)  # magic
                if not action.context:
                    continue
                if "active_id" in action.context:
                    raise ValidationError(
                        _('The action "%s" cannot be set as the home action because it requires a record to be selected beforehand.', action.name)
                    )

    @api.constrains('group_ids')
    def _check_disjoint_groups(self):
        """We check that no users are both portal and users (same with public).
           This could typically happen because of implied groups.
        """
        ResGroups = self.env['res.groups']
        group_definitions = ResGroups._get_group_definitions()
        for user in self:
            all_group_ids = user.all_group_ids.ids
            disjoint_ids = group_definitions.get_disjoint_ids(all_group_ids).intersection(all_group_ids)
            if disjoint_ids:
                group_names = ResGroups.browse(disjoint_ids).mapped('full_name')
                # If the user has at least two disjoint groups (e.g. portal, public and user)
                raise ValidationError(_('The user cannot be at the same time in groups: %r.', group_names))

    def onchange(self, values, field_names, fields_spec):
        # Hacky fix to access fields in `SELF_READABLE_FIELDS` in the onchange logic.
        # Put field values in the cache.
        if self == self.env.user:
            [self.sudo()[field_name] for field_name in self.SELF_READABLE_FIELDS]
        return super().onchange(values, field_names, fields_spec)

    def read(self, fields=None, load='_classic_read'):
        readable = self.SELF_READABLE_FIELDS
        if fields and self == self.env.user and all(key in readable or key.startswith('context_') for key in fields):
            # safe fields only, so we read as super-user to bypass access rights
            self = self.sudo()
        return super().read(fields=fields, load=load)

    @api.model
    def check_field_access_rights(self, operation, field_names):
        readable = self.SELF_READABLE_FIELDS
        if field_names and self == self.env.user and all(key in readable or key.startswith('context_') for key in field_names):
            # safe fields only, so we read as super-user to bypass access rights
            self = self.sudo()
        return super().check_field_access_rights(operation, field_names)

    @api.model
    def fields_get(self, allfields=None, attributes=None):
        res = super().fields_get(allfields, attributes=attributes)
        # add self readable/writable fields
        missing = set(self.SELF_WRITEABLE_FIELDS).union(self.SELF_READABLE_FIELDS).difference(res.keys())
        if allfields:
            missing = missing.intersection(allfields)
        if missing:
            self = self.sudo()  # noqa: PLW0642
            res.update({
                key: dict(values, readonly=key not in self.SELF_WRITEABLE_FIELDS, searchable=False)
                for key, values in super().fields_get(missing, attributes).items()
            })
        return res

    @api.model
    def _read_group_select(self, aggregate_spec, query):
        try:
            fname, __, __ = models.parse_read_group_spec(aggregate_spec)
        except Exception:
            # may happen if aggregate_spec == '__count', for instance
            fname = None
        if fname in USER_PRIVATE_FIELDS:
            raise AccessError(_("Cannot aggregate on %s parameter", fname))
        return super()._read_group_select(aggregate_spec, query)

    @api.model
    def _read_group_groupby(self, groupby_spec, query):
        fname, __, __ = models.parse_read_group_spec(groupby_spec)
        if fname in USER_PRIVATE_FIELDS:
            raise AccessError(_("Cannot groupby on %s parameter", fname))
        return super()._read_group_groupby(groupby_spec, query)

    @api.model
    def _search(self, domain, offset=0, limit=None, order=None):
        if not self.env.su and domain:
            domain_fields = {term[0] for term in domain if isinstance(term, (tuple, list))}
            if domain_fields.intersection(USER_PRIVATE_FIELDS):
                raise AccessError(_('Invalid search criterion'))
        return super()._search(domain, offset, limit, order)

    @api.model_create_multi
    def create(self, vals_list):
        users = super().create(vals_list)
        setting_vals = []
        for user in users:
            if not user.res_users_settings_ids and user._is_internal():
                setting_vals.append({'user_id': user.id})
            # if partner is global we keep it that way
            if user.partner_id.company_id:
                user.partner_id.company_id = user.company_id
            user.partner_id.active = user.active
            # Generate employee initals as avatar for internal users without image
            if not user.image_1920 and not user.share and user.name:
                user.image_1920 = user.partner_id._avatar_generate_svg()
        if setting_vals:
            self.env['res.users.settings'].sudo().create(setting_vals)
        return users

    def _apply_groups_to_existing_employees(self):
        """ Should new groups be added to existing employees?

        If the template user is being modified, the groups should be applied to
        every other base_user users
        """
        default_user = self.env.ref('base.default_user', raise_if_not_found=False)
        return default_user and default_user in self

    def write(self, values):
        if values.get('active') and SUPERUSER_ID in self._ids:
            raise UserError(_("You cannot activate the superuser."))
        if values.get('active') == False and self._uid in self._ids:
            raise UserError(_("You cannot deactivate the user you're currently logged in as."))

        if values.get('active'):
            # unarchive partners before unarchiving the users
            self.partner_id.action_unarchive()
        if self == self.env.user:
            writeable = self.SELF_WRITEABLE_FIELDS
            for key in list(values):
                if not (key in writeable or key.startswith('context_')):
                    break
            else:
                if 'company_id' in values:
                    if values['company_id'] not in self.env.user.company_ids.ids:
                        del values['company_id']
                # safe fields only, so we write as super-user to bypass access rights
                self = self.sudo()

        old_groups = []
        if 'group_ids' in values and self._apply_groups_to_existing_employees():
            # if modify group_ids content, compute the delta of groups to apply
            # the new ones to other existing users
            old_groups = self._default_groups()

        res = super().write(values)

        if old_groups:
            # new elements in _default_groups() means new groups for default users
            # that needs to be added to existing ones as well for consistency
            added_groups = self._default_groups() - old_groups
            if added_groups:
                internal_users = self.env.ref('base.group_user').all_user_ids - self
                internal_users.write({'group_ids': [Command.link(gid) for gid in added_groups.ids]})

        if 'company_id' in values:
            for user in self:
                # if partner is global we keep it that way
                if user.partner_id.company_id and user.partner_id.company_id.id != values['company_id']:
                    user.partner_id.write({'company_id': user.company_id.id})

        if 'company_id' in values or 'company_ids' in values:
            # Reset lazy properties `company` & `companies` on all envs,
            # This is unlikely in a business code to change the company of a user and then do business stuff
            # but in case it happens this is handled.
            # e.g. `account_test_savepoint.py` `setup_company_data`, triggered by `test_account_invoice_report.py`
            for env in list(self.env.transaction.envs):
                if env.user in self:
                    lazy_property.reset_all(env)

        # clear caches linked to the users
        if self.ids and 'group_ids' in values:
            # DLE P139: Calling invalidate_cache on a new, well you lost everything as you wont be able to take it back from the cache
            # `test_00_equipment_multicompany_user`
            self.env['ir.model.access'].call_cache_clearing_methods()

        # per-method / per-model caches have been removed so the various
        # clear_cache/clear_caches methods pretty much just end up calling
        # Registry.clear_cache
        invalidation_fields = self._get_invalidation_fields()
        if (invalidation_fields & values.keys()) or any(key.startswith('context_') for key in values):
            self.env.registry.clear_cache()

        return res

    @api.ondelete(at_uninstall=True)
    def _unlink_except_master_data(self):
        portal_user_template = self.env.ref('base.template_portal_user_id', False)
        default_user_template = self.env.ref('base.default_user', False)
        if SUPERUSER_ID in self.ids:
            raise UserError(_('You can not remove the admin user as it is used internally for resources created by Odoo (updates, module installation, ...)'))
        user_admin = self.env.ref('base.user_admin', raise_if_not_found=False)
        if user_admin and user_admin in self:
            raise UserError(_('You cannot delete the admin user because it is utilized in various places (such as security configurations,...). Instead, archive it.'))
        self.env.registry.clear_cache()
        if (portal_user_template and portal_user_template in self) or (default_user_template and default_user_template in self):
            raise UserError(_('Deleting the template users is not allowed. Deleting this profile will compromise critical functionalities.'))

    @api.model
    def name_search(self, name='', args=None, operator='ilike', limit=100):
        domain = args or []
        # first search only by login, then the normal search
        if (
            name and operator not in expression.NEGATIVE_TERM_OPERATORS
            and (user := self.search_fetch(expression.AND([[('login', '=', name)], domain]), ['display_name']))
        ):
            return [(user.id, user.display_name)]
        return super().name_search(name, domain, operator, limit)

    @api.model
    def _search_display_name(self, operator, value):
        domain = super()._search_display_name(operator, value)
        if operator in ('=', 'ilike') and value:
            name_domain = [('login', '=', value)]
            if users := self.search(name_domain):
                domain = [('id', 'in', users.ids)]
        return domain

    def copy_data(self, default=None):
        default = dict(default or {})
        vals_list = super().copy_data(default=default)
        for user, vals in zip(self, vals_list):
            if ('name' not in default) and ('partner_id' not in default):
                vals['name'] = _("%s (copy)", user.name)
            if 'login' not in default:
                vals['login'] = _("%s (copy)", user.login)
        return vals_list

    @api.model
    @tools.ormcache('self._uid')
    def context_get(self):
        user = self.env.user
        # determine field names to read
        name_to_key = {
            name: name[8:] if name.startswith('context_') else name
            for name in self._fields
            if name.startswith('context_') or name in ('lang', 'tz')
        }
        # use read() to not read other fields: this must work while modifying
        # the schema of models res.users or res.partner
        try:
            values = user.read(list(name_to_key), load=False)[0]
        except IndexError:
            # user not found, no context information
            return frozendict()

        context = {
            key: values[name]
            for name, key in name_to_key.items()
        }

        # ensure lang is set and available
        # context > request > company > english > any lang installed
        langs = [code for code, _ in self.env['res.lang'].get_installed()]
        lang = context.get('lang')
        if lang not in langs:
            lang = request.best_lang if request else None
            if lang not in langs:
                lang = self.env.user.with_context(prefetch_fields=False).company_id.partner_id.lang
                if lang not in langs:
                    lang = DEFAULT_LANG
                    if lang not in langs:
                        lang = langs[0] if langs else DEFAULT_LANG
        context['lang'] = lang

        # ensure uid is set
        context['uid'] = self.env.uid

        return frozendict(context)

    @tools.ormcache('self.id')
    def _get_company_ids(self):
        # use search() instead of `self.company_ids` to avoid extra query for `active_test`
        domain = [('active', '=', True), ('user_ids', 'in', self.id)]
        return self.env['res.company'].search(domain)._ids

    @api.model
    def action_get(self):
        return self.sudo().env.ref('base.action_res_users_my').read()[0]

    @api.model
    def _get_invalidation_fields(self):
        return {
            'group_ids', 'active', 'lang', 'tz', 'company_id', 'company_ids',
            *USER_PRIVATE_FIELDS,
            *self._get_session_token_fields()
        }

    @api.model
    def _update_last_login(self):
        # only create new records to avoid any side-effect on concurrent transactions
        # extra records will be deleted by the periodical garbage collection
        self.env['res.users.log'].sudo().create({}) # populated by defaults

    @api.model
    def _get_login_domain(self, login):
        return [('login', '=', login)]

    @api.model
    def _get_email_domain(self, email):
        return [('email', '=', email)]

    @api.model
    def _get_login_order(self):
        return self._order

    def _login(self, credential, user_agent_env):
        login = credential['login']
        ip = request.httprequest.environ['REMOTE_ADDR'] if request else 'n/a'
        try:
            with self._assert_can_auth(user=login):
                user = self.sudo().search(self._get_login_domain(login), order=self._get_login_order(), limit=1)
                if not user:
                    # ruff: noqa: TRY301
                    raise AccessDenied()
                user = user.with_user(user).sudo()
                auth_info = user._check_credentials(credential, user_agent_env)
                tz = request.cookies.get('tz') if request else None
                if tz in pytz.all_timezones and (not user.tz or not user.login_date):
                    # first login or missing tz -> set tz to browser tz
                    user.tz = tz
                user._update_last_login()
        except AccessDenied:
            _logger.info("Login failed for login:%s from %s", login, ip)
            raise

        _logger.info("Login successful for login:%s from %s", login, ip)

        return auth_info

    def authenticate(self, credential, user_agent_env):
        """Verifies and returns the user ID corresponding to the given
        ``credential``, or False if there was no matching user.

        :param str db: the database on which user is trying to authenticate
        :param dict credential: a dictionary where the `type` key defines the authentication method and
            additional keys are passed as required per authentication method.
            For example:
            - { 'type': 'password', 'login': 'username', 'password': '123456' }
            - { 'type': 'webauthn', 'webauthn_response': '{json data}' }
        :param dict user_agent_env: environment dictionary describing any
            relevant environment attributes
        :return: auth_info
        :rtype: dict
        """
        auth_info = self._login(credential, user_agent_env=user_agent_env)
        if user_agent_env and user_agent_env.get('base_location'):
            env = self.env(user=auth_info['uid'])
            if env.user.has_group('base.group_system'):
                # Successfully logged in as system user!
                # Attempt to guess the web base url...
                try:
                    base = user_agent_env['base_location']
                    ICP = env['ir.config_parameter']
                    if not ICP.get_param('web.base.url.freeze'):
                        ICP.set_param('web.base.url', base)
                except Exception:
                    _logger.exception("Failed to update web.base.url configuration parameter")
        return auth_info

    @classmethod
    @tools.ormcache('uid', 'passwd')
    def check(cls, db, uid, passwd):
        """Verifies that the given (uid, password) is authorized for the database ``db`` and
           raise an exception if it is not."""
        if not passwd:
            # empty passwords disallowed for obvious security reasons
            raise AccessDenied()

        with contextlib.closing(cls.pool.cursor()) as cr:
            self = api.Environment(cr, uid, {})[cls._name]
            with self._assert_can_auth(user=uid):
                if not self.env.user.active:
                    raise AccessDenied()
                credential = {'login': self.env.user.login, 'password': passwd, 'type': 'password'}
                self._check_credentials(credential, {'interactive': False})

    def _get_session_token_fields(self):
        return {'id', 'login', 'password', 'active'}

    def _get_session_token_query_params(self):
        database_secret = SQL("SELECT value FROM ir_config_parameter WHERE key='database.secret'")
        fields = SQL(", ").join(
            SQL.identifier(self._table, fname)
            for fname in sorted(self._get_session_token_fields())
            # To handle `auth_passkey_key_ids`,
            # which we want in the `_get_session_token_fields` list for the cache invalidation mechanism
            # but which we do not want here as it isn't an actual column in the res_users table.
            # Instead, the left join to that table is done with an override of `_get_session_token_query_params`.
            if not self._fields[fname].relational
        )
        return {
            "select": SQL("(%s), %s", database_secret, fields),
            "from": SQL("res_users"),
            "joins": SQL(""),
            "where": SQL("res_users.id = %s", self.id),
            "group_by": SQL("res_users.id"),
        }

    @tools.ormcache('sid')
    def _compute_session_token(self, sid):
        """ Compute a session token given a session id and a user id """
        # retrieve the fields used to generate the session token
        self.env.cr.execute(SQL(
            "SELECT %(select)s FROM %(from)s %(joins)s WHERE %(where)s GROUP BY %(group_by)s",
            **self._get_session_token_query_params(),
        ))
        if self.env.cr.rowcount != 1:
            self.env.registry.clear_cache()
            return False
        data_fields = self.env.cr.fetchone()
        # generate hmac key
        key = (u'%s' % (data_fields,)).encode('utf-8')
        # hmac the session id
        data = sid.encode('utf-8')
        h = hmac.new(key, data, sha256)
        # keep in the cache the token
        return h.hexdigest()

    @api.model
    def change_password(self, old_passwd, new_passwd):
        """Change current user password. Old password must be provided explicitly
        to prevent hijacking an existing user session, or for cases where the cleartext
        password is not used to authenticate requests.

        :return: True
        :raise: odoo.exceptions.AccessDenied when old password is wrong
        :raise: odoo.exceptions.UserError when new password is not set or empty
        """
        if not old_passwd:
            raise AccessDenied()

        # alternatively: use identitycheck wizard?
        credential = {'login': self.env.user.login, 'password': old_passwd, 'type': 'password'}
        self._check_credentials(credential, {'interactive': True})

        # use self.env.user here, because it has uid=SUPERUSER_ID
        self.env.user._change_password(new_passwd)
        return True

    def _change_password(self, new_passwd):
        new_passwd = new_passwd.strip()
        if not new_passwd:
            raise UserError(_("Setting empty passwords is not allowed for security reasons!"))

        ip = request.httprequest.environ['REMOTE_ADDR'] if request else 'n/a'
        _logger.info(
            "Password change for %r (#%d) by %r (#%d) from %s",
             self.login, self.id,
             self.env.user.login, self.env.user.id,
             ip
        )

        self.password = new_passwd

    def _deactivate_portal_user(self, **post):
        """Try to remove the current portal user.

        This is used to give the opportunity to portal users to de-activate their accounts.
        Indeed, as the portal users can easily create accounts, they will sometimes wish
        it removed because they don't use this Odoo portal anymore.

        Before this feature, they would have to contact the website or the support to get
        their account removed, which could be tedious.
        """
        non_portal_users = self.filtered(lambda user: not user.share)
        if non_portal_users:
            raise AccessDenied(_(
                'Only the portal users can delete their accounts. '
                'The user(s) %s can not be deleted.',
                ', '.join(non_portal_users.mapped('name')),
            ))

        ip = request.httprequest.environ['REMOTE_ADDR'] if request else 'n/a'

        res_users_deletion_values = []

        for user in self:
            _logger.info(
                'Account deletion asked for "%s" (#%i) from %s. '
                'Archive the user and remove login information.',
                user.login, user.id, ip,
            )

            user.write({
                'login': f'__deleted_user_{user.id}_{time.time()}',
                'password': '',
            })
            user.api_key_ids._remove()

            res_users_deletion_values.append({
                'user_id': user.id,
                'state': 'todo',
            })

        # Here we try to archive the user / partner, and then add the user in a deletion
        # queue, to remove it from the database. As the deletion might fail (if the
        # partner is related to an invoice e.g.) it's important to archive it here.
        try:
            # A user can not self-deactivate
            self.with_user(SUPERUSER_ID).action_archive()
        except Exception:
            pass
        try:
            self.partner_id.action_archive()
        except Exception:
            pass
        # Add users in the deletion queue
        self.env['res.users.deletion'].create(res_users_deletion_values)

    def preference_save(self):
        return {
            'type': 'ir.actions.client',
            'tag': 'reload_context',
        }

    @check_identity
    def preference_change_password(self):
        return {
            'type': 'ir.actions.act_window',
            'target': 'new',
            'res_model': 'change.password.own',
            'view_mode': 'form',
        }

    @check_identity
    def action_revoke_all_devices(self):
        return self._action_revoke_all_devices()

    def _action_revoke_all_devices(self):
        devices = self.env["res.device"].search([("user_id", "=", self.id)])
        devices.filtered(lambda d: not d.is_current)._revoke()
        return {'type': 'ir.actions.client', 'tag': 'reload'}

    def has_groups(self, group_spec: str) -> bool:
        """ Return whether user ``self`` satisfies the given group restrictions
        ``group_spec``, i.e., whether it is member of at least one of the groups,
        and is not a member of any of the groups preceded by ``!``.

        Note that the group ``"base.group_no_one"`` is only effective in debug
        mode, just like method :meth:`~.has_group` does.

        :param str group_spec: comma-separated list of fully-qualified group
            external IDs, optionally preceded by ``!``.
            Example:``"base.group_user,base.group_portal,!base.group_system"``.
        """
        if group_spec == '.':
            return False

        positives = []
        negatives = []
        for group_ext_id in group_spec.split(','):
            group_ext_id = group_ext_id.strip()
            if group_ext_id.startswith('!'):
                negatives.append(group_ext_id[1:])
            else:
                positives.append(group_ext_id)

        # for the sake of performance, check negatives first
        if any(self.has_group(ext_id) for ext_id in negatives):
            return False
        if any(self.has_group(ext_id) for ext_id in positives):
            return True
        return not positives

    def has_group(self, group_ext_id: str) -> bool:
        """ Return whether user ``self`` belongs to the given group (given by its
        fully-qualified external ID).

        Note that the group ``"base.group_no_one"`` is only effective in debug
        mode: the method returns ``True`` if the user belongs to the group and
        the current request is in debug mode.
        """
        self.ensure_one()
        if not (self.env.su or self == self.env.user or self.env.user._has_group('base.group_user')):
            # this prevents RPC calls from non-internal users to retrieve
            # information about other users
            raise AccessError(_("You can ony call user.has_group() with your current user."))

        result = self._has_group(group_ext_id)
        if group_ext_id == 'base.group_no_one':
            result = result and bool(request and request.session.debug)
        return result

    def _has_group(self, group_ext_id: str) -> bool:
        """ Return whether user ``self`` belongs to the given group.

        :param str group_ext_id: external ID (XML ID) of the group.
           Must be provided in fully-qualified form (``module.ext_id``), as there
           is no implicit module to use..
        :return: True if user ``self`` is a member of the group with the
           given external ID (XML ID), else False.
        """
        group_id = self.env['res.groups']._get_group_definitions().get_id(group_ext_id)
        # for new record don't fill the ormcache
        return group_id in (self._get_group_ids() if self.id else self.all_group_ids._origin._ids)

    @tools.ormcache('self.id')
    def _get_group_ids(self):
        """ Return ``self``'s group ids (as a tuple)."""
        self.ensure_one()
        return self.all_group_ids._ids

    def _action_show(self):
        """If self is a singleton, directly access the form view. If it is a recordset, open a list view"""
        view_id = self.env.ref('base.view_users_form').id
        action = {
            'type': 'ir.actions.act_window',
            'res_model': 'res.users',
            'context': {'create': False},
        }
        if len(self) > 1:
            action.update({
                'name': _('Users'),
                'view_mode': 'list,form',
                'views': [[None, 'list'], [view_id, 'form']],
                'domain': [('id', 'in', self.ids)],
            })
        else:
            action.update({
                'view_mode': 'form',
                'views': [[view_id, 'form']],
                'res_id': self.id,
            })
        return action

    def action_show_groups(self):
        self.ensure_one()
        return {
            'name': _('Groups'),
            'view_mode': 'list,form',
            'res_model': 'res.groups',
            'type': 'ir.actions.act_window',
            'context': {'create': False, 'delete': False},
            'domain': [('id', 'in', self.all_group_ids.ids)],
            'target': 'current',
        }

    def action_show_accesses(self):
        self.ensure_one()
        return {
            'name': _('Access Rights'),
            'view_mode': 'list,form',
            'res_model': 'ir.model.access',
            'type': 'ir.actions.act_window',
            'context': {'create': False, 'delete': False},
            'domain': [('id', 'in', self.all_group_ids.model_access.ids)],
            'target': 'current',
        }

    def action_show_rules(self):
        self.ensure_one()
        return {
            'name': _('Record Rules'),
            'view_mode': 'list,form',
            'res_model': 'ir.rule',
            'type': 'ir.actions.act_window',
            'context': {'create': False, 'delete': False},
            'domain': [('id', 'in', self.all_group_ids.rule_groups.ids)],
            'target': 'current',
        }

    def _is_internal(self):
        self.ensure_one()
        return self.sudo().has_group('base.group_user')

    def _is_portal(self):
        self.ensure_one()
        return self.sudo().has_group('base.group_portal')

    def _is_public(self):
        self.ensure_one()
        return self.sudo().has_group('base.group_public')

    def _is_system(self):
        self.ensure_one()
        return self.sudo().has_group('base.group_system')

    def _is_admin(self):
        self.ensure_one()
        return self._is_superuser() or self.sudo().has_group('base.group_erp_manager')

    def _is_superuser(self):
        self.ensure_one()
        return self.id == SUPERUSER_ID

    @api.model
    def get_company_currency_id(self):
        return self.env.company.currency_id.id

    @tools.ormcache()
    def _crypt_context(self):
        """ Passlib CryptContext instance used to encrypt and verify
        passwords. Can be overridden if technical, legal or political matters
        require different kdfs than the provided default.

        The work factor of the default KDF can be configured using the
        ``password.hashing.rounds`` ICP.
        """
        cfg = self.env['ir.config_parameter'].sudo()
        return CryptContext(
            # kdf which can be verified by the context. The default encryption
            # kdf is the first of the list
            ['pbkdf2_sha512', 'plaintext'],
            # deprecated algorithms are still verified as usual, but
            # ``needs_update`` will indicate that the stored hash should be
            # replaced by a more recent algorithm.
            deprecated=['auto'],
            pbkdf2_sha512__rounds=max(MIN_ROUNDS, int(cfg.get_param('password.hashing.rounds', 0))),
        )

    @contextlib.contextmanager
    def _assert_can_auth(self, user=None):
        """ Checks that the current environment even allows the current auth
        request to happen.

        The baseline implementation is a simple linear login cooldown: after
        a number of failures trying to log-in, the user (by login) is put on
        cooldown. During the cooldown period, login *attempts* are ignored
        and logged.

        :param user: user id or login, for logging purpose

        .. warning::

            The login counter is not shared between workers and not
            specifically thread-safe, the feature exists mostly for
            rate-limiting on large number of login attempts (brute-forcing
            passwords) so that should not be much of an issue.

            For a more complex strategy (e.g. database or distribute storage)
            override this method. To simply change the cooldown criteria
            (configuration, ...) override _on_login_cooldown instead.

        .. note::

            This is a *context manager* so it can be called around the login
            procedure without having to call it itself.
        """
        # needs request for remote address
        if not request:
            yield
            return

        reg = self.env.registry
        failures_map = getattr(reg, '_login_failures', None)
        if failures_map is None:
            failures_map = reg._login_failures = collections.defaultdict(lambda : (0, datetime.datetime.min))

        source = request.httprequest.remote_addr
        (failures, previous) = failures_map[source]
        if self._on_login_cooldown(failures, previous):
            _logger.warning(
                "Login attempt ignored for %s (user %r) on %s: "
                "%d failures since last success, last failure at %s. "
                "You can configure the number of login failures before a "
                "user is put on cooldown as well as the duration in the "
                "System Parameters. Disable this feature by setting "
                "\"base.login_cooldown_after\" to 0.",
                source, user or "?", self.env.cr.dbname, failures, previous)
            if ipaddress.ip_address(source).is_private:
                _logger.warning(
                    "The rate-limited IP address %s is classified as private "
                    "and *might* be a proxy. If your Odoo is behind a proxy, "
                    "it may be mis-configured. Check that you are running "
                    "Odoo in Proxy Mode and that the proxy is properly configured, see "
                    "https://www.odoo.com/documentation/master/administration/install/deploy.html#https for details.",
                    source
                )
            raise AccessDenied(_("Too many login failures, please wait a bit before trying again."))

        try:
            yield
        except AccessDenied:
            (failures, __) = reg._login_failures[source]
            reg._login_failures[source] = (failures + 1, datetime.datetime.now())
            raise
        else:
            reg._login_failures.pop(source, None)

    def _on_login_cooldown(self, failures, previous):
        """ Decides whether the user trying to log in is currently
        "on cooldown" and not even allowed to attempt logging in.

        The default cooldown function simply puts the user on cooldown for
        <login_cooldown_duration> seconds after each failure following the
        <login_cooldown_after>th (0 to disable).

        Can be overridden to implement more complex backoff strategies, or
        e.g. wind down or reset the cooldown period as the previous failure
        recedes into the far past.

        :param int failures: number of recorded failures (since last success)
        :param previous: timestamp of previous failure
        :type previous:  datetime.datetime
        :returns: whether the user is currently in cooldown phase (true if cooldown, false if no cooldown and login can continue)
        :rtype: bool
        """
        cfg = self.env['ir.config_parameter'].sudo()
        min_failures = int(cfg.get_param('base.login_cooldown_after', 5))
        if min_failures == 0:
            return False

        delay = int(cfg.get_param('base.login_cooldown_duration', 60))
        return failures >= min_failures and (datetime.datetime.now() - previous) < datetime.timedelta(seconds=delay)

    def _register_hook(self):
        if hasattr(self, 'check_credentials'):
            _logger.warning("The check_credentials method of res.users has been renamed _check_credentials. One of your installed modules defines one, but it will not be called anymore.")

    def _mfa_type(self):
        """ If an MFA method is enabled, returns its type as a string. """
        return

    def _mfa_url(self):
        """ If an MFA method is enabled, returns the URL for its second step. """
        return

    def _should_alert_new_device(self):
        """ Determine if an alert should be sent to the user regarding a new device

        To be overriden in 2FA modules implementing known devices
        """
        return False


ResUsersPatchedInTest = ResUsers


# pylint: disable=E0102
class ResUsers(models.Model):  # noqa: F811
    _inherit = 'res.users'

    @api.model_create_multi
    def create(self, vals_list):
        users = super().create(vals_list)
        group_multi_company_id = self.env['ir.model.data']._xmlid_to_res_id(
            'base.group_multi_company', raise_if_not_found=False)
        if group_multi_company_id:
            for user in users:
                if len(user.company_ids) <= 1 and user._has_group('base.group_multi_company'):
                    user.write({'group_ids': [Command.unlink(group_multi_company_id)]})
                elif len(user.company_ids) > 1 and not user._has_group('base.group_multi_company'):
                    user.write({'group_ids': [Command.link(group_multi_company_id)]})
        return users

    def write(self, values):
        res = super().write(values)
        if 'company_ids' not in values:
            return res
        group_multi_company = self.env.ref('base.group_multi_company', False)
        if group_multi_company:
            for user in self:
                if len(user.company_ids) <= 1 and user.id in group_multi_company.all_user_ids.ids:
                    user.write({'group_ids': [Command.unlink(group_multi_company.id)]})
                elif len(user.company_ids) > 1 and user.id not in group_multi_company.all_user_ids.ids:
                    user.write({'group_ids': [Command.link(group_multi_company.id)]})
        return res

    @api.model
    def new(self, values=None, origin=None, ref=None):
        if values is None:
            values = {}
        user = super().new(values=values, origin=origin, ref=ref)
        group_multi_company = self.env.ref('base.group_multi_company', False)
        if group_multi_company and 'company_ids' in values:
            if len(user.company_ids) <= 1 and user.id in group_multi_company.all_user_ids.ids:
                user.update({'group_ids': [Command.unlink(group_multi_company.id)]})
            elif len(user.company_ids) > 1 and user.id not in group_multi_company.all_user_ids.ids:
                user.update({'group_ids': [Command.link(group_multi_company.id)]})
        return user


class ResUsersIdentitycheck(models.TransientModel):
    """ Wizard used to re-check the user's credentials (password) and eventually
    revoke access to his account to every device he has an active session on.

    Might be useful before the more security-sensitive operations, users might be
    leaving their computer unlocked & unattended. Re-checking credentials mitigates
    some of the risk of a third party using such an unattended device to manipulate
    the account.
    """
    _description = "Password Check Wizard"

    request = fields.Char(readonly=True, groups=fields.NO_ACCESS)
    auth_method = fields.Selection([('password', 'Password')], default=lambda self: self._get_default_auth_method())
    password = fields.Char()

    def _get_default_auth_method(self):
        return 'password'

    def _check_identity(self):
        try:
            credential = {
                'login': self.env.user.login,
                'password': self.password,
                'type': 'password',
            }
            self.create_uid._check_credentials(credential, {'interactive': True})
        except AccessDenied:
            raise UserError(_("Incorrect Password, try again or click on Forgot Password to reset your password."))

    def run_check(self):
        assert request, "This method can only be accessed over HTTP"
        self._check_identity()
        self.password = False

        request.session['identity-check-last'] = time.time()
        ctx, model, ids, method, args, kwargs = json.loads(self.sudo().request)
        method = getattr(self.env(context=ctx)[model].browse(ids), method)
        assert getattr(method, '__has_check_identity', False)
        return method(*args, **kwargs)

#----------------------------------------------------------
# change password wizard
#----------------------------------------------------------


class ChangePasswordWizard(models.TransientModel):
    """ A wizard to manage the change of users' passwords. """
    _description = "Change Password Wizard"
    _transient_max_hours = 0.2

    def _default_user_ids(self):
        user_ids = self._context.get('active_model') == 'res.users' and self._context.get('active_ids') or []
        return [
            Command.create({'user_id': user.id, 'user_login': user.login})
            for user in self.env['res.users'].browse(user_ids)
        ]

    user_ids = fields.One2many('change.password.user', 'wizard_id', string='Users', default=_default_user_ids)

    def change_password_button(self):
        self.ensure_one()
        self.user_ids.change_password_button()
        if self.env.user in self.user_ids.user_id:
            return {'type': 'ir.actions.client', 'tag': 'reload'}
        return {'type': 'ir.actions.act_window_close'}


class ChangePasswordUser(models.TransientModel):
    """ A model to configure users in the change password wizard. """
    _description = 'User, Change Password Wizard'

    wizard_id = fields.Many2one('change.password.wizard', string='Wizard', required=True, ondelete='cascade')
    user_id = fields.Many2one('res.users', string='User', required=True, ondelete='cascade')
    user_login = fields.Char(string='User Login', readonly=True)
    new_passwd = fields.Char(string='New Password', default='')

    def change_password_button(self):
        for line in self:
            if line.new_passwd:
                line.user_id._change_password(line.new_passwd)
        # don't keep temporary passwords in the database longer than necessary
        self.write({'new_passwd': False})


class ChangePasswordOwn(models.TransientModel):
    _name = 'change.password.own'
    _description = "User, change own password wizard"
    _transient_max_hours = 0.1

    new_password = fields.Char(string="New Password")
    confirm_password = fields.Char(string="New Password (Confirmation)")

    @api.constrains('new_password', 'confirm_password')
    def _check_password_confirmation(self):
        if self.confirm_password != self.new_password:
            raise ValidationError(_("The new password and its confirmation must be identical."))

    @check_identity
    def change_password(self):
        self.env.user._change_password(self.new_password)
        self.unlink()
        # reload to avoid a session expired error
        # would be great to update the session id in-place, but it seems dicey
        return {'type': 'ir.actions.client', 'tag': 'reload'}

# API keys support
API_KEY_SIZE = 20 # in bytes
INDEX_SIZE = 8 # in hex digits, so 4 bytes, or 20% of the key
KEY_CRYPT_CONTEXT = CryptContext(
    # default is 29000 rounds which is 25~50ms, which is probably unnecessary
    # given in this case all the keys are completely random data: dictionary
    # attacks on API keys isn't much of a concern
    ['pbkdf2_sha512'], pbkdf2_sha512__rounds=6000,
)


# pylint: disable=E0102
class ResUsers(models.Model):  # noqa: F811
    _inherit = 'res.users'

    api_key_ids = fields.One2many('res.users.apikeys', 'user_id', string="API Keys")

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS + ['api_key_ids']

    @property
    def SELF_WRITEABLE_FIELDS(self):
        return super().SELF_WRITEABLE_FIELDS + ['api_key_ids']

    def _rpc_api_keys_only(self):
        """ To be overridden if RPC access needs to be restricted to API keys, e.g. for 2FA """
        return False

    def _check_credentials(self, credential, user_agent_env):
        user_agent_env = user_agent_env or {}
        if user_agent_env.get('interactive', True):
            if 'interactive' not in user_agent_env:
                _logger.warning(
                    "_check_credentials without 'interactive' env key, assuming interactive login. \
                    Check calls and overrides to ensure the 'interactive' key is properly set in \
                    all _check_credentials environments"
                )
            return super()._check_credentials(credential, user_agent_env)

        if not self.env.user._rpc_api_keys_only():
            try:
                return super()._check_credentials(credential, user_agent_env)
            except AccessDenied:
                pass

        # 'rpc' scope does not really exist, we basically require a global key (scope NULL)
        if self.env['res.users.apikeys']._check_credentials(scope='rpc', key=credential['password']) == self.env.uid:
            return {
                'uid': self.env.user.id,
                'auth_method': 'apikey',
                'mfa': 'default',
            }

        raise AccessDenied()

    @check_identity
    def api_key_wizard(self):
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'res.users.apikeys.description',
            'name': 'New API Key',
            'target': 'new',
            'views': [(False, 'form')],
        }


class ResUsersApikeys(models.Model):
    _name = 'res.users.apikeys'
    _description = 'Users API Keys'
    _auto = False # so we can have a secret column
    _allow_sudo_commands = False

    name = fields.Char("Description", required=True, readonly=True)
    user_id = fields.Many2one('res.users', index=True, required=True, readonly=True, ondelete="cascade")
    scope = fields.Char("Scope", readonly=True)
    create_date = fields.Datetime("Creation Date", readonly=True)
    expiration_date = fields.Datetime("Expiration Date", readonly=True)

    def init(self):
        table = SQL.identifier(self._table)
        self.env.cr.execute(SQL("""
        CREATE TABLE IF NOT EXISTS %(table)s (
            id serial primary key,
            name varchar not null,
            user_id integer not null REFERENCES res_users(id) ON DELETE CASCADE,
            scope varchar,
            expiration_date timestamp without time zone,
            index varchar(%(index_size)s) not null CHECK (char_length(index) = %(index_size)s),
            key varchar not null,
            create_date timestamp without time zone DEFAULT (now() at time zone 'utc')
        )
        """, table=table, index_size=INDEX_SIZE))

        index_name = self._table + "_user_id_index_idx"
        if len(index_name) > 63:
            # unique determinist index name
            index_name = self._table[:50] + "_idx_" + sha256(self._table.encode()).hexdigest()[:8]
        self.env.cr.execute(SQL(
            "CREATE INDEX IF NOT EXISTS %s ON %s (user_id, index)",
            SQL.identifier(index_name),
            table,
        ))

    @check_identity
    def remove(self):
        return self._remove()

    def _remove(self):
        """Use the remove() method to remove an API Key. This method implement logic,
        but won't check the identity (mainly used to remove trusted devices)"""
        if not self:
            return {'type': 'ir.actions.act_window_close'}
        if self.env.is_system() or self.mapped('user_id') == self.env.user:
            ip = request.httprequest.environ['REMOTE_ADDR'] if request else 'n/a'
            _logger.info("API key(s) removed: scope: <%s> for '%s' (#%s) from %s",
               self.mapped('scope'), self.env.user.login, self.env.uid, ip)
            self.sudo().unlink()
            return {'type': 'ir.actions.act_window_close'}
        raise AccessError(_("You can not remove API keys unless they're yours or you are a system user"))

    def _check_credentials(self, *, scope, key):
        assert scope and key, "scope and key required"
        index = key[:INDEX_SIZE]
        self.env.cr.execute('''
            SELECT user_id, key
            FROM {} INNER JOIN res_users u ON (u.id = user_id)
            WHERE
                u.active and index = %s
                AND (scope IS NULL OR scope = %s)
                AND (
                    expiration_date IS NULL OR
                    expiration_date >= now() at time zone 'utc'
                )
        '''.format(self._table),
        [index, scope])
        for user_id, current_key in self.env.cr.fetchall():
            if key and KEY_CRYPT_CONTEXT.verify(key, current_key):
                return user_id

    def _check_expiration_date(self, date):
        # To be in a sudoed environment or to be an administrator
        # to create a persistent key (no expiration date) or
        # to exceed the maximum duration determined by the user's privileges.
        if self.env.is_system():
            return
        if not date:
            raise ValidationError(_("The API key must have an expiration date"))
        max_duration = max(group.api_key_duration for group in self.env.user.all_group_ids) or 1.0
        if date > datetime.datetime.now() + datetime.timedelta(days=max_duration):
            raise ValidationError(_("You cannot exceed %(duration)s days.", duration=max_duration))

    def _generate(self, scope, name, expiration_date):
        """Generates an api key.
        :param str scope: the scope of the key. If None, the key will give access to any rpc.
        :param str name: the name of the key, mainly intended to be displayed in the UI.
        :param date expiration_date: the expiration date of the key.
        :return: str: the key.

        Note:
        This method must be called in sudo to use a duration
        greater than that allowed by the user's privileges.
        For a persistent key (infinite duration), no value for expiration date.
        """
        self._check_expiration_date(expiration_date)
        # no need to clear the LRU when *adding* a key, only when removing
        k = binascii.hexlify(os.urandom(API_KEY_SIZE)).decode()
        self.env.cr.execute("""
        INSERT INTO {table} (name, user_id, scope, expiration_date, key, index)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
        """.format(table=self._table),
        [name, self.env.user.id, scope, expiration_date or None, KEY_CRYPT_CONTEXT.hash(k), k[:INDEX_SIZE]])

        ip = request.httprequest.environ['REMOTE_ADDR'] if request else 'n/a'
        _logger.info("%s generated: scope: <%s> for '%s' (#%s) from %s",
            self._description, scope, self.env.user.login, self.env.uid, ip)

        return k

    @api.autovacuum
    def _gc_user_apikeys(self):
        self.env.cr.execute(SQL("""
            DELETE FROM %s
            WHERE
                expiration_date IS NOT NULL AND
                expiration_date < now() at time zone 'utc'
        """, SQL.identifier(self._table)))
        _logger.info("GC %r delete %d entries", self._name, self.env.cr.rowcount)


class ResUsersApikeysDescription(models.TransientModel):
    _name = 'res.users.apikeys.description'
    _description = 'API Key Description'

    def _selection_duration(self):
        # duration value is a string representing the number of days.
        durations = [
            ('1', '1 Day'),
            ('7', '1 Week'),
            ('30', '1 Month'),
            ('90', '3 Months'),
            ('180', '6 Months'),
            ('365', '1 Year'),
        ]
        persistent_duration = ('0', 'Persistent Key')  # Magic value to detect an infinite duration
        custom_duration = ('-1', 'Custom Date')  # Will force the user to enter a date manually
        if self.env.is_system():
            return durations + [persistent_duration, custom_duration]
        max_duration = max(group.api_key_duration for group in self.env.user.all_group_ids) or 1.0
        return list(filter(
            lambda duration: int(duration[0]) <= max_duration, durations
        )) + [custom_duration]

    name = fields.Char("Description", required=True)
    duration = fields.Selection(
        selection='_selection_duration', string='Duration', required=True,
        default=lambda self: self._selection_duration()[0][0]
    )
    expiration_date = fields.Datetime('Expiration Date', compute='_compute_expiration_date', store=True, readonly=False)

    @api.depends('duration')
    def _compute_expiration_date(self):
        for record in self:
            duration = int(record.duration)
            if duration >= 0:
                record.expiration_date = (
                    fields.Date.today() + datetime.timedelta(days=duration)
                    if int(record.duration)
                    else None
                )

    @api.onchange('expiration_date')
    def _onchange_expiration_date(self):
        try:
            self.env['res.users.apikeys']._check_expiration_date(self.expiration_date)
        except UserError as error:
            warning = {
                'type': 'notification',
                'title': _('The API key duration is not correct.'),
                'message': error.args[0]
            }
            return {'warning': warning}

    def create(self, vals_list):
        res = super().create(vals_list)
        self.env['res.users.apikeys']._check_expiration_date(res.expiration_date)
        return res

    @check_identity
    def make_key(self):
        # only create keys for users who can delete their keys
        self.check_access_make_key()

        description = self.sudo()
        k = self.env['res.users.apikeys']._generate(None, description.name, self.expiration_date)
        description.unlink()

        return {
            'type': 'ir.actions.act_window',
            'res_model': 'res.users.apikeys.show',
            'name': _('API Key Ready'),
            'views': [(False, 'form')],
            'target': 'new',
            'context': {
                'default_key': k,
            }
        }

    def check_access_make_key(self):
        if not self.env.user._is_internal():
            raise AccessError(_("Only internal users can create API keys"))


class ResUsersApikeysShow(models.AbstractModel):
    _name = 'res.users.apikeys.show'
    _description = 'Show API Key'

    # the field 'id' is necessary for the onchange that returns the value of 'key'
    id = fields.Id()
    key = fields.Char(readonly=True)
