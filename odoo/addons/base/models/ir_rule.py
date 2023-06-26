# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import warnings

from odoo import api, fields, models, tools, SUPERUSER_ID, _
from odoo.exceptions import AccessDenied, ValidationError
from odoo.osv import expression
from odoo.tools import config
from odoo.tools.safe_eval import safe_eval, time

_logger = logging.getLogger(__name__)
class IrRule(models.Model):
    _name = 'ir.rule'
    _description = 'Record Rule'
    _order = 'model_id DESC,id'
    _MODES = ['read', 'write', 'create', 'unlink']

    name = fields.Char(index=True)
    active = fields.Boolean(default=True, help="If you uncheck the active field, it will disable the record rule without deleting it (if you delete a native record rule, it may be re-created when you reload the module).")
    model_id = fields.Many2one('ir.model', string='Model', index=True, required=True, ondelete="cascade")
    groups = fields.Many2many('res.groups', 'rule_group_rel', 'rule_group_id', 'group_id', ondelete='restrict')
    domain_force = fields.Text(string='Domain')
    perm_read = fields.Boolean(string='Apply for Read', default=True)
    perm_write = fields.Boolean(string='Apply for Write', default=True)
    perm_create = fields.Boolean(string='Apply for Create', default=True)
    perm_unlink = fields.Boolean(string='Apply for Delete', default=True)

    _sql_constraints = [
        ('no_access_rights',
         'CHECK (perm_read!=False or perm_write!=False or perm_create!=False or perm_unlink!=False)',
         'Rule must have at least one checked access right!'),
    ]

    @api.model
    def _eval_context(self):
        """Returns a dictionary to use as evaluation context for
           ir.rule domains.
           Note: company_ids contains the ids of the activated companies
           by the user with the switch company menu. These companies are
           filtered and trusted.
        """
        # use an empty context for 'user' to make the domain evaluation
        # independent from the context
        return {
            'user': self.env.user.with_context({}),
            'time': time,
            'company_ids': self.env.companies.ids,
            'company_id': self.env.company.id,
        }

    @api.depends('groups')
    def _compute_global(self):
        for rule in self:
            rule['global'] = not rule.groups

    @api.constrains('model_id')
    def _check_model_name(self):
        # Don't allow rules on rules records (this model).
        if any(rule.model_id.model == self._name for rule in self):
            raise ValidationError(_('Rules can not be applied on the Record Rules model.'))

    def _compute_domain_keys(self):
        """ Return the list of context keys to use for caching ``_compute_domain``. """
        return ['allowed_company_ids']

    def _get_failing(self, for_records, mode='read'):
        """ Returns the rules for the mode for the current user which fail on
        the specified records.

        Can return any global rule and/or all local rules (since local rules
        are OR-ed together, the entire group succeeds or fails, while global
        rules get AND-ed and can each fail)
        """
        Model = for_records.browse(()).sudo()
        eval_context = self._eval_context()

        all_rules = self._get_rules(Model._name, mode=mode).sudo()

        # first check if the group rules fail for any record (aka if
        # searching on (records, group_rules) filters out some of the records)
        group_rules = all_rules.filtered(lambda r: r.groups and r.groups & self.env.user.groups_id)
        group_domains = expression.OR([
            safe_eval(r.domain_force, eval_context) if r.domain_force else []
            for r in group_rules
        ])
        # if all records get returned, the group rules are not failing
        if Model.search_count(expression.AND([[('id', 'in', for_records.ids)], group_domains])) == len(for_records):
            group_rules = self.browse(())

        # failing rules are previously selected group rules or any failing global rule
        def is_failing(r, ids=for_records.ids):
            dom = safe_eval(r.domain_force, eval_context) if r.domain_force else []
            return Model.search_count(expression.AND([
                [('id', 'in', ids)],
                expression.normalize_domain(dom)
            ])) < len(ids)

        return all_rules.filtered(lambda r: r in group_rules or (not r.groups and is_failing(r))).with_user(self.env.user)

    def _get_rules(self, model_name, mode='read'):
        """ Returns all the rules matching the model for the mode for the
        current user.
        """
        if mode not in self._MODES:
            raise ValueError('Invalid mode: %r' % (mode,))

        if self.env.su:
            return self.browse(())

        query = """ SELECT r.id FROM ir_rule r JOIN ir_model m ON (r.model_id=m.id)
                    WHERE m.model=%s AND r.active AND r.perm_{mode}
                    AND (r.id IN (SELECT rule_group_id FROM rule_group_rel rg
                                  JOIN res_groups_users_rel gu ON (rg.group_id=gu.gid)
                                  WHERE gu.uid=%s)
                         OR r.global)
                    ORDER BY r.id
                """.format(mode=mode)
        self._cr.execute(query, (model_name, self._uid))
        return self.browse(row[0] for row in self._cr.fetchall())

    @api.model
    @tools.conditional(
        'xml' not in config['dev_mode'],
        tools.ormcache('self.env.uid', 'self.env.su', 'model_name', 'mode',
                       'tuple(self._compute_domain_context_values())'),
    )
    def _compute_domain(self, model_name, mode="read"):
        rules = self._get_rules(model_name, mode=mode)
        if not rules:
            return

        # browse user and rules as SUPERUSER_ID to avoid access errors!
        eval_context = self._eval_context()
        user_groups = self.env.user.groups_id
        global_domains = []                     # list of domains
        group_domains = []                      # list of domains
        for rule in rules.sudo():
            # evaluate the domain for the current user
            dom = safe_eval(rule.domain_force, eval_context) if rule.domain_force else []
            dom = expression.normalize_domain(dom)
            if not rule.groups:
                global_domains.append(dom)
            elif rule.groups & user_groups:
                group_domains.append(dom)

        # combine global domains and group domains
        if not group_domains:
            return expression.AND(global_domains)
        return expression.AND(global_domains + [expression.OR(group_domains)])

    def _compute_domain_context_values(self):
        for k in self._compute_domain_keys():
            v = self._context.get(k)
            if isinstance(v, list):
                # currently this could be a frozenset (to avoid depending on
                # the order of allowed_company_ids) but it seems safer if
                # possibly slightly more miss-y to use a tuple
                v = tuple(v)
            yield v

    @api.model
    def clear_cache(self):
        warnings.warn("Deprecated IrRule.clear_cache(), use IrRule.clear_caches() instead", DeprecationWarning)
        self.clear_caches()

    def unlink(self):
        res = super(IrRule, self).unlink()
        self.clear_caches()
        return res

    @api.model_create_multi
    def create(self, vals_list):
        res = super(IrRule, self).create(vals_list)
        # DLE P33: tests
        self.env.flush_all()
        self.clear_caches()
        return res

    def write(self, vals):
        res = super(IrRule, self).write(vals)
        # DLE P33: tests
        # - odoo/addons/test_access_rights/tests/test_feedback.py
        # - odoo/addons/test_access_rights/tests/test_ir_rules.py
        # - odoo/addons/base/tests/test_orm.py (/home/dle/src/odoo/master-nochange-fp/odoo/addons/base/tests/test_orm.py)
        self.env.flush_all()
        self.clear_caches()
        return res

    def _make_access_error(self, operation, records):
        _logger.info('Access Denied by record rules for operation: %s on record ids: %r, uid: %s, model: %s', operation, records.ids[:6], self._uid, records._name)

        model = records._name
        description = self.env['ir.model']._get(model).name or model
        operation_error = _("Uh-oh! Looks like you have stumled upon some top-secret %ss.", description)
        resolution_info_per_operation = {
            'read':   _("If you really, really need access, go bribe your friendly administrator"),
            'write':  _("But don’t worry, a little birdie told me that if you try to charm the administrators with some humor, they might just grant you that coveted access you seek!"),
            'create': _("The administrators hold the keys to creation, so flash them a charming smile, ask nicely, and they might grant you the power to bring new records to life! "),
            'unlink': _("The administrators are the gatekeepers of this power. Approach them kindly and they may grant you the ability to delete records responsibly."),
        }
        resolution_info = resolution_info_per_operation[operation]
        if not self.env.user.has_group('base.group_no_one') or not self.env.user.has_group('base.group_user'):
            records.invalidate_recordset()
            return AccessDenied(f"{operation_error}\n\n{resolution_info}")

        user_description = f'{self.env.user.name} (id={self.env.user.id})'
        user_msg_per_operation = {
            # Messages are declared in extenso so they are properly exported in translation terms
            'read':   _("\n\nSorry, my friend %s don't have the clearance for that kind of fun.", user_description),
            'write':  _("\n\nSorry my friend, %s doesn’t have the VIP pass for record-editing fun.", user_description),
            'create': _("\n\nHey, %(description)s creator! %(user_description)s is missing the magic wand to conjure new %(description)ss.", description=description, user_description=user_description),
            'unlink': _("\n\nSorry my friend, %s is missing the secret sauce to perform the mystical art of %s deletion.", user_description, description),
        }

        # This extended AccessDenied is only displayed in debug mode.
        # Note that by default, public and portal users do not have
        # the group "base.group_no_one", even if debug mode is enabled,
        # so it is relatively safe here to include the list of rules and record names.
        rules = self._get_failing(records, mode=operation).sudo()

        records_sudo = records[:6].sudo()
        company_related = any('company_id' in (r.domain_force or '') for r in rules)

        def get_record_description(rec):
            # If the user has access to the company of the record, add this
            # information in the description to help them to change company
            if company_related and 'company_id' in rec and rec.company_id in self.env.user.company_ids:
                return f'{description}, {rec.display_name} ({model}: {rec.id}, company={rec.company_id.display_name})'
            return f'{description}, {rec.display_name} ({model}: {rec.id})'

        failing_records = '\n '.join(f'- {get_record_description(rec)}' for rec in records_sudo)

        rules_description = '\n'.join(f'- {rule.name}' for rule in rules)
        failing_rules = _("Blame the following rules:\n%s", rules_description)

        if company_related:
            msg_heads = {
                'read':   _("Uh-oh! You've stumbled upon a %s trapped in a multi-company mystery.", description),
                'write':  _("Uh-oh! You're trying to edit a %s trapped in a multi-company mystery.", description),
                'create': _("Uh-oh! %s doesn’t have the power to create a record outside of your company’s boundaries.", user_description),
                'unlink': _("Uh-oh! You're trying to delete a %s trapped in a multi-company mystery.", description),
            }
            user_msg_per_operation = {
                'read':   _("\n\nThis %s belongs to a company that is strictly off-limits for %s access.", description, user_description),
                'write':  _("\n\nSorry my friend, this record belongs to a company that is strictly off %s limits.", user_description),
                'create': _(""),
                'unlink': _("\n\nSorry my friend, %s is missing the secret sauce to delete a record that's off-limits for our record-deleting  escapades.", user_description)
            }

            operation_error = msg_heads[operation]
            read_write_resolution = _("But don't lose heart! There are plenty of other captivating records within your own company's boundaries, waiting to be discorvered.")
            resolution_info_per_operation = {
                'read': read_write_resolution,
                'write': read_write_resolution,
                'create': _("Let's focus on the exciting record-creating opportunities within our own company instead! Adventure awaits!"),
                'unlink': "",
            }
            resolution_info = resolution_info_per_operation[operation]
        user_message = user_msg_per_operation[operation]

        # clean up the cache of records prefetched with display_name above
        records_sudo.invalidate_recordset()

        msg = f"{operation_error}\n{failing_records}{user_message}\n\n{failing_rules}\n\n{resolution_info}"
        return AccessDenied(msg)


#
# Hack for field 'global': this field cannot be defined like others, because
# 'global' is a Python keyword. Therefore, we add it to the class by assignment.
# Note that the attribute '_module' is normally added by the class' metaclass.
#
global_ = fields.Boolean(compute='_compute_global', store=True,
                         help="If no group is specified the rule is global and applied to everyone")
setattr(IrRule, 'global', global_)
global_.__set_name__(IrRule, 'global')
