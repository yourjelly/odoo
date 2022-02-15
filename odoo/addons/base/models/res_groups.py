# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from lxml import etree
from lxml.builder import E

from odoo import api, fields, models, _, Command
from odoo.addons.base.models.ir_model import MODULE_UNINSTALL_FLAG
from odoo.exceptions import UserError
from odoo.osv import expression

VIEW_DEPS = ('category_id', 'implied_ids')

#
# Functions for manipulating boolean and selection pseudo-fields
#
def name_boolean_group(id):
    return 'in_group_' + str(id)

def name_selection_groups(ids):
    return 'sel_groups_' + '_'.join(str(it) for it in sorted(ids))

def is_boolean_group(name):
    return name.startswith('in_group_')

def is_selection_groups(name):
    return name.startswith('sel_groups_')

def is_reified_group(name):
    return is_boolean_group(name) or is_selection_groups(name)

def get_boolean_group(name):
    return int(name[9:])

def get_selection_groups(name):
    return [int(v) for v in name[11:].split('_')]


class ResGroups(models.Model):
    _name = "res.groups"
    _description = "Access Groups"
    _rec_name = 'full_name'
    _order = 'name'

    name = fields.Char(required=True, translate=True)
    users = fields.Many2many('res.users', 'res_groups_users_rel', 'gid', 'uid')
    model_access = fields.One2many('ir.model.access', 'group_id', string='Access Controls', copy=True)
    rule_groups = fields.Many2many('ir.rule', 'rule_group_rel',
        'group_id', 'rule_group_id', string='Rules', domain=[('global', '=', False)])
    menu_access = fields.Many2many('ir.ui.menu', 'ir_ui_menu_group_rel', 'gid', 'menu_id', string='Access Menu')
    view_access = fields.Many2many('ir.ui.view', 'ir_ui_view_group_rel', 'group_id', 'view_id', string='Views')
    comment = fields.Text(translate=True)
    category_id = fields.Many2one('ir.module.category', string='Application', index=True)
    color = fields.Integer(string='Color Index')
    full_name = fields.Char(compute='_compute_full_name', string='Group Name', search='_search_full_name')
    share = fields.Boolean(string='Share Group', help="Group created to set access rights for sharing data with some users.")

    implied_ids = fields.Many2many('res.groups', 'res_groups_implied_rel', 'gid', 'hid',
        string='Inherits', help='Users of this group automatically inherit those groups')
    trans_implied_ids = fields.Many2many('res.groups', string='Transitively inherits',
        compute='_compute_trans_implied', recursive=True)

    _sql_constraints = [
        ('name_uniq', 'unique (category_id, name)', 'The name of the group must be unique within an application!')
    ]

    #=== COMPUTE METHODS ===#

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
            domains = [[('name', operator, operand)], [('category_id.name', operator, operand)]]
            if operator in expression.NEGATIVE_TERM_OPERATORS == (not operand):
                return expression.AND(domains)
            else:
                return expression.OR(domains)
        if isinstance(operand, str):
            lst = False
            operand = [operand]
        where = []
        for group in operand:
            values = [v for v in group.split('/') if v]
            group_name = values.pop().strip()
            category_name = values and '/'.join(values).strip() or group_name
            group_domain = [('name', operator, lst and [group_name] or group_name)]
            category_domain = [('category_id.name', operator, lst and [category_name] or category_name)]
            if operator in expression.NEGATIVE_TERM_OPERATORS and not values:
                category_domain = expression.OR([category_domain, [('category_id', '=', False)]])
            if (operator in expression.NEGATIVE_TERM_OPERATORS) == (not values):
                sub_where = expression.AND([group_domain, category_domain])
            else:
                sub_where = expression.OR([group_domain, category_domain])
            if operator in expression.NEGATIVE_TERM_OPERATORS:
                where = expression.AND([where, sub_where])
            else:
                where = expression.OR([where, sub_where])
        return where

    @api.depends('implied_ids.trans_implied_ids')
    def _compute_trans_implied(self):
        # Compute the transitive closure recursively. Note that the performance
        # is good, because the record cache behaves as a memo (the field is
        # never computed twice on a given group.)
        for g in self:
            g.trans_implied_ids = g.implied_ids | g.implied_ids.trans_implied_ids

    #=== CONSTRAINT METHODS ===#

    @api.constrains('users')
    def _check_one_user_type(self):
        self.users._check_one_user_type()

    #=== CRUD METHODS ===#

    @api.model_create_multi
    def create(self, vals_list):
        user_ids_list = [vals.pop('users', None) for vals in vals_list]
        groups = super().create(vals_list)
        for group, user_ids in zip(groups, user_ids_list):
            if user_ids:
                # delegate addition of users to add implied groups
                group.write({'users': user_ids})
        self._update_user_groups_view()
        # actions.get_bindings() depends on action records
        self.env['ir.actions.actions'].clear_caches()
        return groups

    def copy(self, default=None):
        self.ensure_one()
        chosen_name = default.get('name') if default else ''
        default_name = chosen_name or _('%s (copy)', self.name)
        default = dict(default or {}, name=default_name)
        return super().copy(default)

    def write(self, values):
        if 'name' in values:
            if values['name'].startswith('-'):
                raise UserError(_('The name of the group can not start with "-"'))
        # determine which values the "user groups view" depends on
        view_values0 = [g[name] for name in VIEW_DEPS if name in values for g in self]
        # invalidate caches before updating groups, since the recomputation of
        # field 'share' depends on method has_group()
        # DLE P139
        if self.ids:
            self.env['ir.model.access'].call_cache_clearing_methods()
            self.env['res.users'].has_group.clear_cache(self.env['res.users'])
        super().write(values)
        if values.get('users') or values.get('implied_ids'):
            self._add_implied_groups()
        # update the "user groups view" only if necessary
        view_values1 = [g[name] for name in VIEW_DEPS if name in values for g in self]
        if view_values0 != view_values1:
            self._update_user_groups_view()
        # actions.get_bindings() depends on action records
        self.env['ir.actions.actions'].clear_caches()

    def _add_implied_groups(self):
        # add all implied groups (to all users of each group)
        for group in self:
            self._cr.execute("""
                WITH RECURSIVE group_imply(gid, hid) AS (
                    SELECT gid, hid
                        FROM res_groups_implied_rel
                        UNION
                    SELECT i.gid, r.hid
                        FROM res_groups_implied_rel r
                        JOIN group_imply i ON (i.hid = r.gid)
                )
                INSERT INTO res_groups_users_rel (gid, uid)
                        SELECT i.hid, r.uid
                        FROM group_imply i, res_groups_users_rel r
                        WHERE r.gid = i.gid
                        AND i.gid = %(gid)s
                        EXCEPT
                        SELECT r.gid, r.uid
                        FROM res_groups_users_rel r
                        JOIN group_imply i ON (r.gid = i.hid)
                        WHERE i.gid = %(gid)s
            """, dict(gid=group.id))
        self._check_one_user_type()

    def unlink(self):
        res = super().unlink()
        self._update_user_groups_view()
        # actions.get_bindings() depends on action records
        self.env['ir.actions.actions'].clear_caches()
        return res

    #=== ORM OVERRIDES ===#

    @api.model
    def _search(self, args, offset=0, limit=None, order=None, count=False, access_rights_uid=None):
        # add explicit ordering if search is sorted on full_name
        if order and order.startswith('full_name'):
            groups = super().search(args)
            groups = groups.sorted('full_name', reverse=order.endswith('DESC'))
            groups = groups[offset:offset+limit] if limit else groups[offset:]
            return len(groups) if count else groups.ids
        return super()._search(args, offset=offset, limit=limit, order=order, count=count, access_rights_uid=access_rights_uid)

    #=== BUSINESS METHODS ===#

    def _apply_group(self, implied_group):
        """ Add the given group to the groups implied by the current group
        :param implied_group: the implied group to add
        """
        if implied_group not in self.implied_ids:
            self.write({'implied_ids': [Command.link(implied_group.id)]})

    def _remove_group(self, implied_group):
        """ Remove the given group from the implied groups of the current group
        :param implied_group: the implied group to remove
        """
        if implied_group in self.implied_ids:
            self.write({'implied_ids': [Command.unlink(implied_group.id)]})
            implied_group.write({'users': [Command.unlink(user.id) for user in self.users]})

    @api.model
    def _update_user_groups_view(self):
        """ Modify the view with xmlid ``base.user_groups_view``, which inherits
            the user form view, and introduces the reified group fields.
        """
        # remove the language to avoid translations, it will be handled at the view level
        self = self.with_context(lang=None)

        # We have to try-catch this, because at first init the view does not
        # exist but we are already creating some basic groups.
        view = self.env.ref('base.user_groups_view', raise_if_not_found=False)
        if not (view and view.exists() and view._name == 'ir.ui.view'):
            return

        if self._context.get('install_filename') or self._context.get(MODULE_UNINSTALL_FLAG):
            # use a dummy view during install/upgrade/uninstall
            xml = E.field(name="groups_id", position="after")

        else:
            group_no_one = view.env.ref('base.group_no_one')
            group_employee = view.env.ref('base.group_user')
            xml1, xml2, xml3 = [], [], []
            xml_by_category = {}
            xml1.append(E.separator(string='User Type', colspan="2", groups='base.group_no_one'))

            user_type_field_name = ''
            user_type_readonly = str({})
            sorted_tuples = sorted(self.get_groups_by_application(),
                                   key=lambda t: t[0].xml_id != 'base.module_category_user_type')
            for app, kind, gs, category_name in sorted_tuples:  # we process the user type first
                attrs = {}
                # hide groups in categories 'Hidden' and 'Extra' (except for group_no_one)
                if app.xml_id in self._get_hidden_extra_categories():
                    attrs['groups'] = 'base.group_no_one'

                # User type (employee, portal or public) is a separated group. This is the only 'selection'
                # group of res.groups without implied groups (with each other).
                if app.xml_id == 'base.module_category_user_type':
                    # application name with a selection field
                    field_name = name_selection_groups(gs.ids)
                    user_type_field_name = field_name
                    user_type_readonly = str({'readonly': [(user_type_field_name, '!=', group_employee.id)]})
                    attrs['widget'] = 'radio'
                    # Trigger the on_change of this "virtual field"
                    attrs['on_change'] = '1'
                    xml1.append(E.field(name=field_name, **attrs))
                    xml1.append(E.newline())

                elif kind == 'selection':
                    # application name with a selection field
                    field_name = name_selection_groups(gs.ids)
                    attrs['attrs'] = user_type_readonly
                    if category_name not in xml_by_category:
                        xml_by_category[category_name] = []
                        xml_by_category[category_name].append(E.newline())
                    xml_by_category[category_name].append(E.field(name=field_name, **attrs))
                    xml_by_category[category_name].append(E.newline())

                else:
                    # application separator with boolean fields
                    app_name = app.name or 'Other'
                    xml3.append(E.separator(string=app_name, colspan="4", **attrs))
                    attrs['attrs'] = user_type_readonly
                    for g in gs:
                        field_name = name_boolean_group(g.id)
                        if g == group_no_one:
                            # make the group_no_one invisible in the form view
                            xml3.append(E.field(name=field_name, invisible="1", **attrs))
                        else:
                            xml3.append(E.field(name=field_name, **attrs))

            xml3.append({'class': "o_label_nowrap"})
            if user_type_field_name:
                user_type_attrs = {'invisible': [(user_type_field_name, '!=', group_employee.id)]}
            else:
                user_type_attrs = {}

            for xml_cat in sorted(xml_by_category.keys(), key=lambda it: it[0]):
                master_category_name = xml_cat[1]
                xml2.append(E.group(*(xml_by_category[xml_cat]), col="2", string=master_category_name))

            xml = E.field(
                E.group(*(xml1), col="2", groups="base.group_no_one"),
                E.group(*(xml2), col="2", attrs=str(user_type_attrs)),
                E.group(*(xml3), col="4", attrs=str(user_type_attrs), groups="base.group_no_one"), name="groups_id", position="replace")
            xml.addprevious(etree.Comment("GENERATED AUTOMATICALLY BY GROUPS"))

        # serialize and update the view
        xml_content = etree.tostring(xml, pretty_print=True, encoding="unicode")
        if xml_content != view.arch:  # avoid useless xml validation if no change
            new_context = dict(view._context)
            new_context.pop('install_filename', None)  # don't set arch_fs for this computed view
            new_context['lang'] = None
            view.with_context(new_context).write({'arch': xml_content})

    def _get_hidden_extra_categories(self):
        return ['base.module_category_hidden', 'base.module_category_extra', 'base.module_category_usability']

    def get_application_groups(self, domain):
        """ Return the non-share groups that satisfy ``domain``. """
        return self.search(domain + [('share', '=', False)])

    @api.model
    def get_groups_by_application(self):
        """ Return all groups classified by application (module category), as a list::

                [(app, kind, groups), ...],

            where ``app`` and ``groups`` are recordsets, and ``kind`` is either
            ``'boolean'`` or ``'selection'``. Applications are given in sequence
            order.  If ``kind`` is ``'selection'``, ``groups`` are given in
            reverse implication order.
        """
        def linearize(app, gs, category_name):
            # 'User Type' is an exception
            if app.xml_id == 'base.module_category_user_type':
                return (app, 'selection', gs.sorted('id'), category_name)
            # determine sequence order: a group appears after its implied groups
            order = {g: len(g.trans_implied_ids & gs) for g in gs}
            # We want a selection for Accounting too. Auditor and Invoice are both
            # children of Accountant, but the two of them make a full accountant
            # so it makes no sense to have checkboxes.
            if app.xml_id == 'base.module_category_accounting_accounting':
                return (app, 'selection', gs.sorted(key=order.get), category_name)
            # check whether order is total, i.e., sequence orders are distinct
            if len(set(order.values())) == len(gs):
                return (app, 'selection', gs.sorted(key=order.get), category_name)
            else:
                return (app, 'boolean', gs, (100, 'Other'))

        # classify all groups by application
        by_app, others = defaultdict(self.browse), self.browse()
        for g in self.get_application_groups([]):
            if g.category_id:
                by_app[g.category_id] += g
            else:
                others += g
        # build the result
        res = []
        for app, gs in sorted(by_app.items(), key=lambda it: it[0].sequence or 0):
            if app.parent_id:
                res.append(linearize(app, gs, (app.parent_id.sequence, app.parent_id.name)))
            else:
                res.append(linearize(app, gs, (100, 'Other')))

        if others:
            res.append((self.env['ir.module.category'], 'boolean', others, (100,'Other')))
        return res
