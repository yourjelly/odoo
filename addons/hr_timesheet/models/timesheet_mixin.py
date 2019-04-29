# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class AnalyticParentMixin(models.AbstractModel):
    _name = 'timesheet.parent.mixin'
    _description = 'Analytic Parent Mixin'

    allow_timesheets = fields.Boolean("Allow timesheets", default=True, help="Enable timesheeting on this service.")
    analytic_account_id = fields.Many2one('account.analytic.account', string="Analytic Account", copy=False, ondelete='set null',
        help="Analytic account to which this project is linked for financial management."
             "Use an analytic account to record cost and revenue on your project.")

    @api.onchange('analytic_account_id')
    def _onchange_analytic_account(self):
        if not self.analytic_account_id and self._origin:
            self.allow_timesheets = False

    @api.constrains('allow_timesheets', 'analytic_account_id')
    def _check_allow_timesheet(self):
        for project in self:
            if project.allow_timesheets and not project.analytic_account_id:
                raise ValidationError(_('To allow timesheet, your project %s should have an analytic account set.' % (project.name,)))

    # ---------------------------------------------------------
    # CRUD and ORM Methods
    # ---------------------------------------------------------

    @api.model_create_multi
    def create(self, list_values):
        """ Create an analytic account if record allow timesheet and don't provide one
            Note: create it before calling super() to avoid raising the ValidationError from _check_allow_timesheet
        """
        default_allow_timesheets = self.default_get(['allow_timesheets'])['allow_timesheets']
        for values in list_values:
            allow_timesheets = values['allow_timesheets'] if 'allow_timesheets' in values else default_allow_timesheets
            if allow_timesheets and not values.get('analytic_account_id'):
                analytic_account_values = self._timesheet_create_account_extract_values(values)
                analytic_account = self.env['account.analytic.account'].create(analytic_account_values)
                values['analytic_account_id'] = analytic_account.id
        return super(AnalyticParentMixin, self).create(list_values)

    @api.multi
    def write(self, values):
        # create the AA for record still allowing timesheet
        if values.get('allow_timesheets'):
            for record in self:
                if not record.analytic_account_id and not values.get('analytic_account_id'):
                    record._timesheet_create_account()
        result = super(AnalyticParentMixin, self).write(values)
        return result

    # ---------------------------------------------------------
    # Business Methods
    # ---------------------------------------------------------

    @api.model
    def _timesheet_create_account_extract_values(self, values):
        """ Extract value to create an analytic account from the `create` value of the record
            implementing the analytic.parent.mixin
        """
        default_company_id = self._default_get(['company_id'])['company_id']
        return {
            'name': values.get(self._rec_name, _('Unknown Analytic Account')),
            'active': True,
            'partner_id': values.get('partner_id') if hasattr(self, 'partner_id') else False,
            'company_id': values.get('company_id', default_company_id) if hasattr(self, 'company_id') else default_company_id,
        }

    @api.model
    def _init_data_analytic_account(self):
        self.search([('analytic_account_id', '=', False), ('allow_timesheets', '=', True)])._timesheet_create_account()

    def _timesheet_create_account(self):
        for record in self:
            values = record._timesheet_create_account_prepare_values()
            analytic_account = self.env['account.analytic.account'].create(values)
            record.write({'analytic_account_id': analytic_account.id})

    def _timesheet_create_account_prepare_values(self):
        """ Retrun the value required to create an analytic account from an existing record
            inheriting the parent.service.mixin
        """
        values = {
            'name': self.display_name,
            'active': True,
        }
        if hasattr(self, 'partner_id'):
            values['partner_id'] = self.partner_id.id
        if hasattr(self, 'company_id'):
            values['company_id'] = self.company_id.id
        return values


class TimesheetMixin(models.AbstractModel):
    _name = 'timesheet.pack.mixin'
    _description = 'Analytic Pack Mixin'
    _timesheet_parent_field = None

    timesheet_pack_id = fields.Many2one('timesheet.pack', string="Timesheet Pack", domain=lambda self: [('res_model', '=', self._name)], auto_join=True)
    analytic_account_id = fields.Many2one('account.analytic.account', related='timesheet_pack_id.analytic_account_id', readonly=False)

    # ---------------------------------------------------------
    # CRUD Methods
    # ---------------------------------------------------------

    @api.model_create_multi
    def create(self, list_values):
        # get a map for project_id --> analytic_account_id
        parent_analytic_account_map = self._timesheet_find_default_parent_account(list_values)

        pack_value_list = []
        pack_parent_index = {}
        for index, vals in enumerate(list_values):
            if not vals.get('timesheet_pack_id'):  # if the pack is not given, check to create one
                pack_vals = self._timesheet_create_pack_extract_values(vals, parent_analytic_account_map)
                if pack_vals:  # if the parent has an AA set, then create the pack
                    pack_value_list.append(pack_vals)
                    pack_parent_index[index] = len(pack_value_list) - 1

        services = self.env['timesheet.pack'].create(pack_value_list)

        for index, vals in enumerate(list_values):
            if pack_parent_index.get(index):
                vals['timesheet_pack_id'] = services[pack_parent_index.get(index)].id

        result = super(TimesheetMixin, self).create(list_values)

        # Update the res_id of the newly created services with the newly create records with one query
        self._cr.execute("""
            UPDATE timesheet_pack
            SET res_id = O.id
            FROM timesheet_pack P
            INNER JOIN %s O ON O.timesheet_pack_id = P.id
            WHERE P.id IN (%%s)
        """ % (self._table,), (services.ids,))

        self.env['timesheet.pack'].invalidate_cache(fnames=['res_id'], ids=services.ids)
        return result

    # ---------------------------------------------------------
    # Business / Helpers Methods
    # ---------------------------------------------------------

    def _timesheet_find_default_parent_account(self, list_values):
        """ From a create list of values, deduced the default analytic accound from the parent record. This requires
            the attribute `_analytic_parent_field` to be set.
        """
        parent_field_name = self._timesheet_parent_field
        parent_res_model = self._fields[parent_field_name].comodel_name

        parent_ids = [vals[parent_field_name] for vals in list_values if vals.get(parent_field_name)]
        parent_analytic_account_map = {record.id: record.analytic_account_id.id for record in self.env[parent_res_model].browse(parent_ids)}

        return parent_analytic_account_map

    def _timesheet_create_pack_extract_values(self, values, parent_default_analytic_account_map):
        """ Extract values to create a pack from the values to create the current model
            :param values: values to create a current record (implementing the mixin)
            :param parent_default_analytic_account_map: map of default analytic_account_id per record parent
            :returns values to create an analytic.pack, None if not analytic account can be deduced
        """
        analytic_account_id = values.pop('analytic_account_id', False)
        if not analytic_account_id and self._timesheet_parent_field in values:
            analytic_account_id = parent_default_analytic_account_map.get(values[self._timesheet_parent_field])
        if analytic_account_id:
            return {
                'name': values.get(self._rec_name, _("Unknown Service")),
                'analytic_account_id': analytic_account_id,
                'res_model': self._name,
            }
        return None

    def _timesheet_create_pack(self):
        list_values = []
        for record in self:
            list_values.append(record._timesheet_create_pack_prepare_values())
        packs = self.env['analytic.pack'].create(list_values)
        for index, record in enumerate(self):
            record.write({'timesheet_pack_id': packs[index].id})

    def _timesheet_create_pack_prepare_values(self):
        return {
            'name': self.display_name,
            'analytic_account_id': self[self._timesheet_parent_field].analytic_account_id.id,
            'res_model': self._name,
            'res_id': self.id,
        }
