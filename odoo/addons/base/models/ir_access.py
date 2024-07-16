from collections.abc import Iterator
import logging

from odoo import models, fields, api
from odoo.exceptions import AccessError, ValidationError
from odoo.osv import expression
from odoo.tools import ormcache
from odoo.tools.safe_eval import safe_eval, time
from odoo.tools.translate import _lt, _

_logger = logging.getLogger(__name__)

OPERATIONS = {
    'read': _lt("read"),
    'write': _lt("write"),
    'create': _lt("create"),
    'unlink': _lt("unlink"),
}

MODEL_ACCESS_ERROR = {
    'read': _lt("You are not allowed to access '%(document_kind)s' (%(document_model)s) records."),
    'write': _lt("You are not allowed to modify '%(document_kind)s' (%(document_model)s) records."),
    'create': _lt("You are not allowed to create '%(document_kind)s' (%(document_model)s) records."),
    'unlink': _lt("You are not allowed to delete '%(document_kind)s' (%(document_model)s) records."),
}

MODES = {
    'r': 'for_read',
    'w': 'for_write',
    'c': 'for_create',
    'd': 'for_unlink',
}


class IrAccess(models.Model):
    """ Access control records with domains. """
    _name = 'ir.access'
    _description = "Model Access"
    _order = 'model_id, group_id, id'
    _allow_sudo_commands = False

    name = fields.Char()
    active = fields.Boolean(default=True, help="Only active accesses are taken into account when checking access rights.")
    model_id = fields.Many2one('ir.model', string="Model", required=True, ondelete='cascade', index=True)
    group_id = fields.Many2one('res.groups', string="Group", ondelete='restrict', index=True)
    for_read = fields.Boolean(help="Whether this access record applies for operation 'read'")
    for_write = fields.Boolean(help="Whether this access record applies for operation 'write'")
    for_create = fields.Boolean(help="Whether this access record applies for operation 'create'")
    for_unlink = fields.Boolean(help="Whether this access record applies for operation 'unlink'")
    mode = fields.Char(
        compute='_compute_mode', store=False, readonly=False,
        help="Code specifying which operations this access applies to, a subset of 'rwcd'.",
    )
    domain = fields.Char()

    @api.depends('for_read', 'for_write', 'for_create', 'for_unlink')
    def _compute_mode(self):
        for access in self:
            access.mode = "".join(char for char, field_name in MODES.items() if access[field_name])

    def _expand_mode(self, vals):
        """ Convert a dict of field values containing field 'mode'. """
        if 'mode' in vals:
            vals = dict(vals)
            mode = vals.pop('mode') or ""
            for char, field_name in MODES.items():
                for_operation = char in mode
                if field_name in vals and bool(vals[field_name]) != for_operation:
                    raise ValidationError(_(
                        "Inconsistent field values: mode=%(mode)s, %(field)s=%(value)s.",
                        mode=repr(mode), field=field_name, value=vals[field_name],
                    ))
                vals[field_name] = for_operation
        return vals

    #
    # ormcache invalidation and management of 'mode'
    #
    @api.model_create_multi
    def create(self, vals_list):
        accesses = super().create([self._expand_mode(vals) for vals in vals_list])
        self.env.registry.clear_cache()
        return accesses

    def write(self, values):
        result = super().write(self._expand_mode(values))
        self.env.registry.clear_cache()
        return result

    def unlink(self):
        result = super().unlink()
        self.env.registry.clear_cache()
        return result

    @ormcache('self.env.uid', 'model_name', 'operation', 'tuple(self._get_access_context())')
    def _get_access_domain(self, model_name: str, operation: str) -> list | None:
        """ Return the domain that determines on which records of ``model_name``
        the current user is allowed to perform ``operation``.  The domain comes
        from the permissions and restrictions that applies to the current user.
        If no permission exists for the current user, the method returns ``None``.
        """
        assert operation in OPERATIONS, "Invalid access operation"

        accesses = self._get_access_records(model_name, operation)
        if not accesses.group_id:
            # no group access implies no permission at all
            return None

        # collect permissions and restrictions
        permissions = []
        restrictions = []
        eval_context = self._eval_context()
        for access in accesses:
            domain = safe_eval(access.domain, eval_context) if access.domain else []
            if access.group_id:
                permissions.append(domain)
            else:
                restrictions.append(domain)

        # add access for parent models as restrictions
        for parent_model_name, parent_field_name in self.env[model_name]._inherits.items():
            domain = self._get_access_domain(parent_model_name, operation)
            if domain is None:
                return None
            restrictions.append([(parent_field_name, 'any', domain)])

        domain = expression.OR(permissions)
        if restrictions:
            domain = expression.AND([domain, *restrictions])
        return domain

    def _get_access_records(self, model_name: str, operation: str):
        """ Returns all the accesses matching the given model for the operation
        for the current user.
        """
        model_id = self.env['ir.model']._get_id(model_name)
        group_ids = self.env.user._get_group_ids()
        domain = [
            ('model_id', '=', model_id),
            ('group_id', 'in', [*group_ids, False]),
            (f'for_{operation}', '=', True),
            ('active', '=', True),
        ]
        return self.sudo().search_fetch(domain, ['group_id', 'domain'], order='id')

    def _get_access_context(self) -> Iterator:
        """ Return the context values that the evaluation of the access domain depends on. """
        yield tuple(self.env.context.get('allowed_company_ids', ()))

    def _eval_context(self):
        """Returns a dictionary to use as evaluation context for access domains.
       Note: ``company_ids`` contains the ids of the activated companies by the
       user with the switch company menu. These companies are filtered and trusted.
        """
        # use an empty context for 'user' to make the domain evaluation
        # independent from the context
        return {
            'user': self.env.user.with_context({}),
            'time': time,
            'company_ids': self.env.companies.ids,
            'company_id': self.env.company.id,
        }

    @ormcache('model_name', 'operation')
    def _get_access_groups(self, model_name, operation='read'):
        """ Return the group expression object that represents the users who
        can perform ``operation`` on model ``model_name``.
        """
        assert operation in OPERATIONS, "Invalid access operation"
        accesses = self._get_access_records(model_name, operation)
        group_definitions = self.env['res.groups']._get_group_definitions()
        return group_definitions.from_ids(accesses.group_id.ids)

    def _make_access_error(self, records, operation: str) -> AccessError:
        """ Return the exception to be raised in case of access error.
        Use an empty ``records`` if the current user has no permission at all to
        perform ``operation`` on the model.
        """
        if records:
            return self._make_record_access_error(records, operation)
        else:
            return self._make_model_access_error(records._name, operation)

    def _make_model_access_error(self, model_name: str, operation: str) -> AccessError:
        operation_error = str(MODEL_ACCESS_ERROR[operation]) % dict(
            document_kind=self.env['ir.model']._get(model_name).name or model_name,
            document_model=model_name,
        )

        groups = self._get_groups_with_access(model_name, operation)
        if groups:
            group_info = _(
                "This operation is allowed for the following groups:\n%(groups_list)s",
                groups_list="\n".join(f"\t- {group.full_name}" for group in groups),
            )
        else:
            group_info = _("No group currently allows this operation.")

        resolution_info = _("Contact your administrator to request access if necessary.")

        message = f"{operation_error}\n\n{group_info}\n\n{resolution_info}"
        return AccessError(message)

    def _get_groups_with_access(self, model_name: str, operation: str) -> models.Model:
        """ Return the groups that provide permissions for ``operation`` on ``model_name``. """
        assert operation in OPERATIONS, "Invalid access operation"

        model_id = self.env['ir.model']._get_id(model_name)
        access_domain = [
            ('model_id', '=', model_id),
            ('group_id', '!=', False),
            (f'for_{operation}', '=', True),
            ('active', '=', True),
        ]
        accesses = self.sudo().search_fetch(access_domain, ['group_id'])
        return accesses.group_id

    def _make_record_access_error(self, records, operation: str) -> AccessError:
        _logger.info(
            "Access Denied for operation: %s on record ids: %r, uid: %s, model: %s",
            operation, records.ids[:6], self.env.uid, records._name,
        )
        self = self.with_context(self.env.user.context_get())

        model_name = records._name
        model_description = self.env['ir.model']._get(model_name).name or model_name
        user_description = f"{self.env.user.name} (id={self.env.uid})"
        operation_error = _(
            "Uh-oh! Looks like you have stumbled upon some top-secret records.\n\n"
            "Sorry, %(user)s doesn't have '%(operation)s' access to:",
            user=user_description, operation=str(OPERATIONS[operation]),
        )
        failing_model = _(
            "- %(description)s (%(model)s)",
            description=model_description, model=model_name,
        )

        resolution_info = _(
            "If you really, really need access, perhaps you can win over your "
            "friendly administrator with a batch of freshly baked cookies."
        )

        if not self.env.user.has_group('base.group_no_one') or not self.env.user._is_internal():
            records.invalidate_recordset()
            return AccessError(f"{operation_error}\n{failing_model}\n\n{resolution_info}")

        # This extended AccessError is only displayed in debug mode.
        # Note that by default, public and portal users do not have the
        # group "base.group_no_one", even if debug mode is enabled, so it is
        # relatively safe here to include the list of accesses and record names.
        accesses = self._get_failed_accesses(records, operation)

        records_sudo = records[:6].sudo()
        company_related = any('company_id' in (access.domain or '') for access in accesses)

        def get_description(record):
            # If the user has access to the company of the record, add this
            # information in the description to help them to change company
            if company_related and 'company_id' in record and record.company_id in self.env.user.company_ids:
                return f'{model_description}, {record.display_name} ({model_name}: {record.id}, company={record.company_id.display_name})'
            return f'{model_description}, {record.display_name} ({model_name}: {record.id})'

        failing_records = '\n'.join(f'- {get_description(record)}' for record in records_sudo)

        access_description = '\n'.join(f'- {access.display_name}' for access in accesses)
        failing_rules = _("Blame the following accesses:\n%s", access_description)

        if company_related:
            failing_rules += "\n\n" + _('Note: this might be a multi-company issue. Switching company may help - in Odoo, not in real life!')

        # clean up the cache of records prefetched with display_name above
        records_sudo.invalidate_recordset()

        msg = f"{operation_error}\n{failing_records}\n\n{failing_rules}\n\n{resolution_info}"
        return AccessError(msg)

    def _get_failed_accesses(self, records, operation: str):
        """ Return the access records for the given operation for the current
        user that fail on the given records.

        Can return any permission and/or restriction (since permissions are
        OR-ed together, the entire group succeeds or fails, while restrictions
        are AND-ed and can each fail independently.)
        """
        model = records.browse(()).sudo().with_context(active_test=False)
        eval_context = self._eval_context()

        accesses = self._get_access_records(model._name, operation)

        # first check if the permissions fail for any record (aka if searching
        # on (records, permissions) filters out some of the records)
        permissions = accesses.filtered('group_id')
        permission_domain = expression.OR([
            safe_eval(access.domain, eval_context) if access.domain else []
            for access in permissions
        ])
        # if all records get returned, the group accesses are not failing
        if len(records.sudo().filtered_domain(permission_domain)) == len(records):
            permissions = self.browse()

        # failing accesses are previously selected permissions or any failing restriction
        def is_failing(access):
            if access.group_id:
                return access in permissions
            domain = safe_eval(access.domain, eval_context) if access.domain else []
            return len(records.sudo().filtered_domain(domain)) < len(records)

        return accesses.filtered(is_failing)
