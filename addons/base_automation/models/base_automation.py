# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime
import logging
import traceback
from collections import defaultdict

from dateutil.relativedelta import relativedelta

from odoo import _, api, exceptions, fields, models
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT
from odoo.tools import safe_eval

_logger = logging.getLogger(__name__)

DATE_RANGE_FUNCTION = {
    'minutes': lambda interval: relativedelta(minutes=interval),
    'hour': lambda interval: relativedelta(hours=interval),
    'day': lambda interval: relativedelta(days=interval),
    'month': lambda interval: relativedelta(months=interval),
    False: lambda interval: relativedelta(0),
}

DATE_RANGE_FACTOR = {
    'minutes': 1,
    'hour': 60,
    'day': 24 * 60,
    'month': 30 * 24 * 60,
    False: 0,
}

ON_CREATE_TRIGGER = 'on_create'
ON_WRITE_TRIGGER = 'on_write'
ON_CREATE_OR_WRITE_TRIGGER = 'on_create_or_write'
ON_UNLINK_TRIGGER = 'on_unlink'
ON_CHANGE_TRIGGER = 'on_change'
ON_TIME_TRIGGER = 'on_time'
SMART_TRIGGER = 'smart'

CREATION_TRIGGERS = (ON_CREATE_TRIGGER, ON_CREATE_OR_WRITE_TRIGGER)
UPDATE_TRIGGERS = (ON_WRITE_TRIGGER, ON_CREATE_OR_WRITE_TRIGGER)


class BaseAutomation(models.Model):
    _name = 'base.automation'
    _description = 'Automation Rule'

    name = fields.Char(string="Automation Rule Name", required=True, translate=True)
    model_id = fields.Many2one(
        "ir.model", string="Model", required=True, ondelete="cascade", help="Model on which the automation rule runs."
    )
    model_name = fields.Char(related="model_id.model", string="Model Name", readonly=True, store=True)
    action_server_ids = fields.One2many(
        "ir.actions.server",
        "base_automation_id",
        "Server Actions",
        domain="[('model_id', '=', model_id)]",
        required=True,
    )
    active = fields.Boolean(default=True, help="When unchecked, the rule is hidden and will not be executed.")
    trigger = fields.Selection(
        [
            (ON_CREATE_TRIGGER, "When a record is created"),
            (ON_WRITE_TRIGGER, "When a record is updated"),
            (ON_CREATE_OR_WRITE_TRIGGER, "When a record is created or updated"),
            (ON_UNLINK_TRIGGER, "When a record is deleted"),
            (ON_CHANGE_TRIGGER, "Based on form modification"),
            (ON_TIME_TRIGGER, "Based on time condition"),
            (SMART_TRIGGER, "Based on smart and simple configurable properties")
        ], string='Trigger', required=True)
    smart_details = fields.Json("Smart Trigger Details")
    trg_date_id = fields.Many2one(
        'ir.model.fields', string='Trigger Date',
        compute='_compute_trg_date_id',
        readonly=False, store=True,
        domain="[('model_id', '=', model_id), ('ttype', 'in', ('date', 'datetime'))]",
        help="""When should the condition be triggered.
                If present, will be checked by the scheduler. If empty, will be checked at creation and update.""")
    trg_date_range = fields.Integer(
        string='Delay after trigger date',
        compute='_compute_trg_date_range_data',
        readonly=False, store=True,
        help="""Delay after the trigger date.
        You can put a negative number if you need a delay before the
        trigger date, like sending a reminder 15 minutes before a meeting.""")
    trg_date_range_type = fields.Selection(
        [('minutes', 'Minutes'), ('hour', 'Hours'), ('day', 'Days'), ('month', 'Months')],
        string='Delay type',
        compute='_compute_trg_date_range_data',
        readonly=False, store=True)
    trg_date_calendar_id = fields.Many2one(
        "resource.calendar", string='Use Calendar',
        compute='_compute_trg_date_calendar_id',
        readonly=False, store=True,
        help="When calculating a day-based timed condition, it is possible to use a calendar to compute the date based on working days.")
    filter_pre_domain = fields.Char(
        string='Before Update Domain',
        compute='_compute_filter_pre_domain',
        readonly=False, store=True,
        help="If present, this condition must be satisfied before the update of the record.")
    filter_domain = fields.Char(
        string='Apply on',
        help="If present, this condition must be satisfied before executing the automation rule.")
    last_run = fields.Datetime(readonly=True, copy=False)
    on_change_field_ids = fields.Many2many(
        "ir.model.fields",
        relation="base_automation_onchange_fields_rel",
        compute='_compute_on_change_field_ids',
        readonly=False, store=True,
        string="On Change Fields Trigger",
        help="Fields that trigger the onchange.",
    )
    trigger_field_ids = fields.Many2many(
        'ir.model.fields', string='Trigger Fields',
        compute='_compute_trigger_field_ids', readonly=False, store=True,
        help="""The automation rule will be triggered if and only if
        one of these fields is updated. If empty, all fields are watched.""")
    least_delay_msg = fields.Char(compute='_compute_least_delay_msg')

    # which fields have an impact on the registry and the cron
    CRITICAL_FIELDS = ['model_id', 'active', 'trigger', 'on_change_field_ids']
    RANGE_FIELDS = ['trg_date_range', 'trg_date_range_type']

    @api.constrains('trigger', 'action_server_ids')
    def _check_trigger_state(self):
        for record in self:
            no_code_actions = record.action_server_ids.filtered(lambda a: a.state != 'code')
            if record.trigger == ON_CHANGE_TRIGGER and len(no_code_actions) > 0:
                raise exceptions.ValidationError(
                    _('Form Modification based automation rules can only be used with code action type.')
                )
            mail_actions = record.action_server_ids.filtered(
                lambda a: a.state in ['mail_post', 'followers', 'next_activity']
            )
            if record.trigger == ON_UNLINK_TRIGGER and len(mail_actions) > 0:
                raise exceptions.ValidationError(
                    _('Email, followers or activities action types cannot be used when deleting records.')
                )

    @api.depends('model_id', 'trigger')
    def _compute_trg_date_id(self):
        invalid = self.filtered(
            lambda a: a.trigger != ON_TIME_TRIGGER or (a.model_id and a.trg_date_id.model_id != a.model_id)
        )
        if invalid:
            invalid.trg_date_id = False

    @api.depends('trigger')
    def _compute_trg_date_range_data(self):
        not_timed = self.filtered(lambda a: a.trigger != ON_TIME_TRIGGER)
        if not_timed:
            not_timed.trg_date_range = False
            not_timed.trg_date_range_type = False
        remaining = (self - not_timed).filtered(lambda a: not a.trg_date_range_type)
        if remaining:
            remaining.trg_date_range_type = 'hour'

    @api.depends('trigger', 'trg_date_id', 'trg_date_range_type')
    def _compute_trg_date_calendar_id(self):
        invalid = self.filtered(
            lambda a: a.trigger != ON_TIME_TRIGGER or not a.trg_date_id or a.trg_date_range_type != 'day'
        )
        if invalid:
            invalid.trg_date_calendar_id = False

    @api.depends('trigger')
    def _compute_filter_pre_domain(self):
        to_reset = self.filtered(lambda a: a.trigger not in UPDATE_TRIGGERS)
        if to_reset:
            to_reset.filter_pre_domain = False

    @api.depends('model_id', 'trigger')
    def _compute_on_change_field_ids(self):
        to_reset = self.filtered(lambda a: a.trigger != ON_CHANGE_TRIGGER)
        if to_reset:
            to_reset.on_change_field_ids = False
        for auto in (self - to_reset).filtered('on_change_field_ids'):
            auto.on_change_field_ids = auto.on_change_field_ids.filtered(lambda field: field.model_id == auto.model_id)

    @api.depends('model_id', 'trigger')
    def _compute_trigger_field_ids(self):
        to_reset = self.filtered(lambda a: a.trigger not in UPDATE_TRIGGERS)
        if to_reset:
            to_reset.trigger_field_ids = False
        for auto in (self - to_reset).filtered('trigger_field_ids'):
            auto.trigger_field_ids = auto.trigger_field_ids.filtered(lambda field: field.model_id == auto.model_id)

    @api.onchange('model_id')
    def _onchange_model(self):
        if len(self.action_server_ids) > 0:
            return {
                'warning': {
                    'title': _("Warning"),
                    'message': _("Changing the model will reset the actions."),
                }
            }

    @api.onchange('trigger', 'action_server_ids')
    def _onchange_trigger_or_actions(self):
        self_sudo = self.sudo()
        no_code_actions = self_sudo.action_server_ids.filtered(lambda a: a.state != 'code')
        if self.trigger == ON_CHANGE_TRIGGER and len(no_code_actions) > 0:
            ff = self.fields_get(['trigger'])
            ff2 = self_sudo.action_server_ids.fields_get(['state'])
            return {'warning': {
                'title': _("Warning"),
                'message': _("The \"%(trigger_value)s\" %(trigger_label)s can only be used with the \"%(state_value)s\" action type") % {
                    'trigger_value': dict(ff['trigger']['selection'])[ON_CHANGE_TRIGGER],
                    'trigger_label': ff['trigger']['string'],
                    'state_value': dict(ff2['state']['selection'])['code'],
                }
            }}

        MAIL_STATES = ('mail_post', 'followers', 'next_activity')
        mail_actions = self_sudo.action_server_ids.filtered(lambda a: a.state in MAIL_STATES)
        if self.trigger == ON_UNLINK_TRIGGER and len(mail_actions) > 0:
            return {'warning': {
                'title': _("Warning"),
                'message': _(
                    "You cannot send an email, add followers or create an activity "
                    "for a deleted record.  It simply does not work."
                ),
            }}

    @api.model_create_multi
    def create(self, vals_list):
        base_automations = super(BaseAutomation, self).create(vals_list)
        self._update_cron()
        self._update_registry()
        return base_automations

    def write(self, vals):
        if 'model_id' in vals:
            for action in self.action_server_ids:
                action.unlink()
        res = super(BaseAutomation, self).write(vals)
        if set(vals).intersection(self.CRITICAL_FIELDS):
            self._update_cron()
            self._update_registry()
        elif set(vals).intersection(self.RANGE_FIELDS):
            self._update_cron()
        return res

    def unlink(self):
        res = super(BaseAutomation, self).unlink()
        self._update_cron()
        self._update_registry()
        return res

    def _update_cron(self):
        """ Activate the cron job depending on whether there exists automation rules
        based on time conditions.  Also update its frequency according to
        the smallest automation delay, or restore the default 4 hours if there
        is no time based automation.
        """
        cron = self.env.ref('base_automation.ir_cron_data_base_automation_check', raise_if_not_found=False)
        if cron:
            automations = self.with_context(active_test=True).search([('trigger', '=', ON_TIME_TRIGGER)])
            cron.try_write({
                'active': bool(automations),
                'interval_type': 'minutes',
                'interval_number': self._get_cron_interval(automations),
            })

    def _update_registry(self):
        """ Update the registry after a modification on automation rules. """
        if self.env.registry.ready and not self.env.context.get('import_file'):
            # re-install the model patches, and notify other workers
            self._unregister_hook()
            self._register_hook()
            self.env.registry.registry_invalidated = True

    def _get_automations(self, records, triggers):
        """ Return the automations of the given triggers for records' model. The
            returned automations' context contain an object to manage processing.
        """
        if '__automation_done' not in self._context:
            self = self.with_context(__automation_done={})
        domain = [('model_name', '=', records._name), ('trigger', 'in', triggers)]
        automations = self.with_context(active_test=True).sudo().search(domain)
        return automations.with_env(self.env)

    def _get_eval_context(self):
        """ Prepare the context used when evaluating python code
            :returns: dict -- evaluation context given to safe_eval
        """
        return {
            'datetime': safe_eval.datetime,
            'dateutil': safe_eval.dateutil,
            'time': safe_eval.time,
            'uid': self.env.uid,
            'user': self.env.user,
        }

    def _get_cron_interval(self, automations=None):
        """ Return the expected time interval used by the cron, in minutes. """
        def get_delay(rec):
            return rec.trg_date_range * DATE_RANGE_FACTOR[rec.trg_date_range_type]

        if automations is None:
            automations = self.with_context(active_test=True).search([('trigger', '=', ON_TIME_TRIGGER)])

        # Minimum 1 minute, maximum 4 hours, 10% tolerance
        delay = min(automations.mapped(get_delay), default=0)
        return min(max(1, delay // 10), 4 * 60) if delay else 4 * 60

    def _compute_least_delay_msg(self):
        msg = _("Note that this automation rule can be triggered up to %d minutes after its schedule.")
        self.least_delay_msg = msg % self._get_cron_interval()

    def _filter_pre(self, records):
        """ Filter the records that satisfy the precondition of automation ``self``. """
        self_sudo = self.sudo()
        if self_sudo.filter_pre_domain and records:
            domain = safe_eval.safe_eval(self_sudo.filter_pre_domain, self._get_eval_context())
            return records.sudo().filtered_domain(domain).with_env(records.env)
        else:
            return records

    def _filter_post(self, records):
        return self._filter_post_export_domain(records)[0]

    def _filter_post_export_domain(self, records):
        """ Filter the records that satisfy the postcondition of automation ``self``. """
        self_sudo = self.sudo()
        if self_sudo.filter_domain and records:
            domain = safe_eval.safe_eval(self_sudo.filter_domain, self._get_eval_context())
            return records.sudo().filtered_domain(domain).with_env(records.env), domain
        else:
            return records, None

    @api.model
    def _add_postmortem_automation(self, e):
        if self.user_has_groups('base.group_user'):
            e.context = {}
            e.context['exception_class'] = 'base_automation'
            e.context['base_automation'] = {
                'id': self.id,
                'name': self.sudo().name,
            }

    def _process(self, records, domain_post=None):
        """ Process automation ``self`` on the ``records`` that have not been done yet. """
        # filter out the records on which self has already been done
        automation_done = self._context['__automation_done']
        records_done = automation_done.get(self, records.browse())
        records -= records_done
        if not records:
            return

        # mark the remaining records as done (to avoid recursive processing)
        automation_done = dict(automation_done)
        automation_done[self] = records_done + records
        self = self.with_context(__automation_done=automation_done)
        records = records.with_context(__automation_done=automation_done)

        # modify records
        values = {}
        if 'date_automation_last' in records._fields:
            values['date_automation_last'] = fields.Datetime.now()
        if values:
            records.write(values)

        # prepare the contexts for server actions
        contexts = []
        for record in records:
            # we process the automation if any watched field has been modified
            if self._check_trigger_fields(record):
                contexts.append({
                    'active_model': record._name,
                    'active_ids': record.ids,
                    'active_id': record.id,
                    'domain_post': domain_post,
                })

        # execute server actions
        for server_action in self.sudo().action_server_ids:
            for ctx in contexts:
                try:
                    server_action.sudo().with_context(**ctx).run()
                except Exception as e:
                    self._add_postmortem_automation(e)
                    raise e

    def _check_trigger_fields(self, record):
        """ Return whether any of the trigger fields has been modified on ``record``. """
        self_sudo = self.sudo()
        if not self_sudo.trigger_field_ids:
            # all fields are implicit triggers
            return True

        if not self._context.get('old_values'):
            # this is a create: all fields are considered modified
            return True

        # Note: old_vals are in the format of read()
        old_vals = self._context['old_values'].get(record.id, {})

        def differ(name):
            field = record._fields[name]
            return (
                name in old_vals and
                field.convert_to_cache(record[name], record, validate=False) !=
                field.convert_to_cache(old_vals[name], record, validate=False)
            )
        return any(differ(field.name) for field in self_sudo.trigger_field_ids)

    def _register_hook(self):
        """ Patch models that should trigger action rules based on creation,
            modification, deletion of records and form onchanges.
        """
        #
        # Note: the patched methods must be defined inside another function,
        # otherwise their closure may be wrong. For instance, the function
        # create refers to the outer variable 'create', which you expect to be
        # bound to create itself. But that expectation is wrong if create is
        # defined inside a loop; in that case, the variable 'create' is bound to
        # the last function defined by the loop.
        #

        def make_create():
            """ Instanciate a create method that processes automation rules. """
            @api.model_create_multi
            def create(self, vals_list, **kw):
                # retrieve the automation rules to possibly execute
                automations = self.env['base.automation']._get_automations(self, CREATION_TRIGGERS)
                if not automations:
                    return create.origin(self, vals_list, **kw)
                # call original method
                records = create.origin(self.with_env(automations.env), vals_list, **kw)
                # check postconditions, and execute actions on the records that satisfy them
                for automation in automations.with_context(old_values=None):
                    automation._process(automation._filter_post(records))
                return records.with_env(self.env)

            return create

        def make_write():
            """ Instanciate a write method that processes automation rules. """
            def write(self, vals, **kw):
                # retrieve the automation rules to possibly execute
                automations = self.env['base.automation']._get_automations(self, UPDATE_TRIGGERS)
                if not (automations and self):
                    return write.origin(self, vals, **kw)
                records = self.with_env(automations.env).filtered('id')
                # check preconditions on records
                pre = {a: a._filter_pre(records) for a in automations}
                # read old values before the update
                old_values = {
                    old_vals.pop('id'): old_vals
                    for old_vals in (records.read(list(vals)) if vals else [])
                }
                # call original method
                write.origin(self.with_env(automations.env), vals, **kw)
                # check postconditions, and execute actions on the records that satisfy them
                for automation in automations.with_context(old_values=old_values):
                    records, domain_post = automation._filter_post_export_domain(pre[automation])
                    automation._process(records, domain_post=domain_post)
                return True

            return write

        def make_compute_field_value():
            """ Instanciate a compute_field_value method that processes automation rules. """
            #
            # Note: This is to catch updates made by field recomputations.
            #
            def _compute_field_value(self, field):
                # determine fields that may trigger an automation
                stored_fields = [f for f in self.pool.field_computed[field] if f.store]
                if not any(stored_fields):
                    return _compute_field_value.origin(self, field)
                # retrieve the action rules to possibly execute
                automations = self.env['base.automation']._get_automations(self, UPDATE_TRIGGERS)
                records = self.filtered('id').with_env(automations.env)
                if not (automations and records):
                    _compute_field_value.origin(self, field)
                    return True
                # check preconditions on records
                pre = {a: a._filter_pre(records) for a in automations}
                # read old values before the update
                old_values = {
                    old_vals.pop('id'): old_vals
                    for old_vals in (records.read([f.name for f in stored_fields]))
                }
                # call original method
                _compute_field_value.origin(self, field)
                # check postconditions, and execute automations on the records that satisfy them
                for automation in automations.with_context(old_values=old_values):
                    records, domain_post = automation._filter_post_export_domain(pre[automation])
                    automation._process(records, domain_post=domain_post)
                return True

            return _compute_field_value

        def make_unlink():
            """ Instanciate an unlink method that processes automation rules. """
            def unlink(self, **kwargs):
                # retrieve the action rules to possibly execute
                automations = self.env['base.automation']._get_automations(self, [ON_UNLINK_TRIGGER])
                records = self.with_env(automations.env)
                # check conditions, and execute actions on the records that satisfy them
                for automation in automations:
                    automation._process(automation._filter_post(records))
                # call original method
                return unlink.origin(self, **kwargs)

            return unlink

        def make_onchange(automation_rule_id):
            """ Instanciate an onchange method for the given automation rule. """
            def base_automation_onchange(self):
                automation_rule = self.env['base.automation'].browse(automation_rule_id)
                result = {}
                server_actions = automation_rule.sudo().action_server_ids.with_context(
                    active_model=self._name,
                    active_id=self._origin.id,
                    active_ids=self._origin.ids,
                    onchange_self=self,
                )
                for server_action in server_actions:
                    try:
                        res = server_action.run()
                    except Exception as e:
                        automation_rule._add_postmortem_automation(e)
                        raise e

                    if res:
                        if 'value' in res:
                            res['value'].pop('id', None)
                            self.update({key: val for key, val in res['value'].items() if key in self._fields})
                        if 'domain' in res:
                            result.setdefault('domain', {}).update(res['domain'])
                        if 'warning' in res:
                            result['warning'] += res["warning"]
                return result

            return base_automation_onchange

        patched_models = defaultdict(set)

        def patch(model, name, method):
            """ Patch method `name` on `model`, unless it has been patched already. """
            if model not in patched_models[name]:
                patched_models[name].add(model)
                ModelClass = type(model)
                method.origin = getattr(ModelClass, name)
                setattr(ModelClass, name, method)

        # retrieve all actions, and patch their corresponding model
        for automation_rule in self.with_context({}).search([]):
            Model = self.env.get(automation_rule.model_name)

            # Do not crash if the model of the base_action_rule was uninstalled
            if Model is None:
                _logger.warning("Automation rule with ID %d depends on model %s" %
                                (automation_rule.id,
                                 automation_rule.model_name))
                continue

            if automation_rule.trigger == ON_CREATE_TRIGGER:
                patch(Model, 'create', make_create())

            elif automation_rule.trigger == ON_CREATE_OR_WRITE_TRIGGER:
                patch(Model, 'create', make_create())
                patch(Model, 'write', make_write())
                patch(Model, '_compute_field_value', make_compute_field_value())

            elif automation_rule.trigger == ON_WRITE_TRIGGER:
                patch(Model, 'write', make_write())
                patch(Model, '_compute_field_value', make_compute_field_value())

            elif automation_rule.trigger == ON_UNLINK_TRIGGER:
                patch(Model, 'unlink', make_unlink())

            elif automation_rule.trigger == ON_CHANGE_TRIGGER:
                # register an onchange method for the automation_rule
                method = make_onchange(automation_rule.id)
                for field in automation_rule.on_change_field_ids:
                    Model._onchange_methods[field.name].append(method)

    def _unregister_hook(self):
        """ Remove the patches installed by _register_hook() """
        NAMES = ['create', 'write', '_compute_field_value', 'unlink', '_onchange_methods']
        for Model in self.env.registry.values():
            for name in NAMES:
                try:
                    delattr(Model, name)
                except AttributeError:
                    pass

    @api.model
    def _check_delay(self, automation, record, record_dt):
        if automation.trg_date_calendar_id and automation.trg_date_range_type == 'day':
            return automation.trg_date_calendar_id.plan_days(
                automation.trg_date_range,
                fields.Datetime.from_string(record_dt),
                compute_leaves=True,
            )
        else:
            delay = DATE_RANGE_FUNCTION[automation.trg_date_range_type](automation.trg_date_range)
            return fields.Datetime.from_string(record_dt) + delay

    @api.model
    def _check(self, automatic=False, use_new_cursor=False):
        """ This Function is called by scheduler. """
        if '__automation_done' not in self._context:
            self = self.with_context(__automation_done={})

        # retrieve all the automation rules to run based on a timed condition
        eval_context = self._get_eval_context()
        for automation in self.with_context(active_test=True).search([('trigger', '=', ON_TIME_TRIGGER)]):
            _logger.info("Starting time-based automation rule `%s`.", automation.name)
            last_run = fields.Datetime.from_string(automation.last_run) or datetime.datetime.utcfromtimestamp(0)

            # retrieve all the records that satisfy the automation's condition
            domain = []
            context = dict(self._context)
            if automation.filter_domain:
                domain = safe_eval.safe_eval(automation.filter_domain, eval_context)
            records = self.env[automation.model_name].with_context(context).search(domain)

            def get_record_dt(record):
                # determine when automation should occur for the records
                if automation.trg_date_id.name == "date_automation_last" and "create_date" in records._fields:
                    return record[automation.trg_date_id.name] or record.create_date
                else:
                    return record[automation.trg_date_id.name]

            # process action on the records that should be executed
            now = datetime.datetime.now()
            for record in records:
                record_dt = get_record_dt(record)
                if not record_dt:
                    continue
                action_dt = self._check_delay(automation, record, record_dt)
                if last_run <= action_dt < now:
                    try:
                        automation._process(record)
                    except Exception:
                        _logger.error(traceback.format_exc())

            automation.write({'last_run': now.strftime(DEFAULT_SERVER_DATETIME_FORMAT)})
            _logger.info("Time-based automation rule `%s` done.", automation.name)

            if automatic:
                # auto-commit for batch processing
                self._cr.commit()
