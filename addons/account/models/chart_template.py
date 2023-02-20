# -*- coding: utf-8 -*-

import ast
from collections import defaultdict
import csv
from functools import wraps
from inspect import getmembers
import logging
import re

from psycopg2.extras import Json

from odoo import Command, _, models, api
from odoo.addons.base.models.ir_model import MODULE_UNINSTALL_FLAG
from odoo.addons.account import SYSCOHADA_LIST
from odoo.exceptions import AccessError
from odoo.tools import file_open

_logger = logging.getLogger(__name__)

TEMPLATE_MODELS = (
    'account.group',
    'account.account',
    'account.tax.group',
    'account.tax',
    'account.journal',
    'account.reconcile.model',
    'account.fiscal.position',
)

TAX_TAG_DELIMITER = '||'


def preserve_existing_tags_on_taxes(env, module):
    ''' This is a utility function used to preserve existing previous tags during upgrade of the module.'''
    xml_records = env['ir.model.data'].search([('model', '=', 'account.account.tag'), ('module', 'like', module)])
    if xml_records:
<<<<<<< HEAD
        env.cr.execute("update ir_model_data set noupdate = 't' where id in %s", [tuple(xml_records.ids)])
||||||| parent of 79ea117593e (temp)
        cr.execute("update ir_model_data set noupdate = 't' where id in %s", [tuple(xml_records.ids)])

def update_taxes_from_templates(cr, chart_template_xmlid):
    def _create_tax_from_template(company, template, old_tax=None):
        """
        Create a new tax from template with template xmlid, if there was already an old tax with that xmlid we
        remove the xmlid from it but don't modify anything else.
        """
        def _remove_xml_id(xml_id):
            module, name = xml_id.split(".", 1)
            env['ir.model.data'].search([('module', '=', module), ('name', '=', name)]).unlink()

        def _avoid_name_conflict():
            conflict_tax = env['account.tax'].search([('name', '=', template.name), ('company_id', '=', company.id),
                                                      ('type_tax_use', '=', template.type_tax_use), ('tax_scope', '=', template.tax_scope)])
            if conflict_tax:
                conflict_tax.name = "[old] " + conflict_tax.name

        template_vals = template._get_tax_vals_complete(company)
        chart_template = env["account.chart.template"].with_context(default_company_id=company.id)
        if old_tax:
            xml_id = old_tax.get_external_id().get(old_tax.id)
            if xml_id:
                _remove_xml_id(xml_id)
        _avoid_name_conflict()
        chart_template.create_record_with_xmlid(company, template, "account.tax", template_vals)

    def _update_tax_from_template(template, tax):
        # -> update the tax : we only updates tax tags
        tax_rep_lines = tax.invoice_repartition_line_ids + tax.refund_repartition_line_ids
        template_rep_lines = template.invoice_repartition_line_ids + template.refund_repartition_line_ids
        for tax_line, template_line in zip(tax_rep_lines, template_rep_lines):
            tags_to_add = template_line._get_tags_to_add()
            tags_to_unlink = tax_line.tag_ids
            if tags_to_add != tags_to_unlink:
                tax_line.write({"tag_ids": [(6, 0, tags_to_add.ids)]})
                _cleanup_tags(tags_to_unlink)

    def _get_template_to_real_xmlid_mapping(company, model):
        """
        This function uses ir_model_data to return a mapping between the templates and the data, using their xmlid
        :returns: {
            account.tax.template.id: account.tax.id
            }
        """
        env['ir.model.data'].flush_model()
        env.cr.execute(
            """
            SELECT template.res_id AS template_res_id,
                   data.res_id AS data_res_id
            FROM ir_model_data data
            JOIN ir_model_data template
            ON template.name = substr(data.name, strpos(data.name, '_') + 1)
            WHERE data.model = %s
            AND data.name LIKE %s
            -- tax.name is of the form: {company_id}_{account.tax.template.name}
            """,
            [model, r"%s\_%%" % company.id],
        )
        tuples = env.cr.fetchall()
        return dict(tuples)

    def _is_tax_and_template_same(template, tax):
        """
        This function compares account.tax and account.tax.template repartition lines.
        A tax is considered the same as the template if they have the same:
            - amount_type
            - amount
            - repartition lines percentages in the same order
        """
        tax_rep_lines = tax.invoice_repartition_line_ids + tax.refund_repartition_line_ids
        template_rep_lines = template.invoice_repartition_line_ids + template.refund_repartition_line_ids
        return (
                tax.amount_type == template.amount_type
                and tax.amount == template.amount
                and len(tax_rep_lines) == len(template_rep_lines)
                and all(
                    rep_line_tax.factor_percent == rep_line_template.factor_percent
                    for rep_line_tax, rep_line_template in zip(tax_rep_lines, template_rep_lines)
                )
        )

    def _cleanup_tags(tags):
        """
        Checks if the tags are still used in taxes or move lines. If not we delete it.
        """
        for tag in tags:
            tax_using_tag = env['account.tax.repartition.line'].sudo().search([('tag_ids', 'in', tag.id)], limit=1)
            aml_using_tag = env['account.move.line'].sudo().search([('tax_tag_ids', 'in', tag.id)], limit=1)
            report_expr_using_tag = tag._get_related_tax_report_expressions()
            if not (aml_using_tag or tax_using_tag or report_expr_using_tag):
                tag.unlink()

    def _update_fiscal_positions_from_templates(company, chart_template_id, new_taxes_template):
        chart_template = env["account.chart.template"].browse(chart_template_id)
        positions = env['account.fiscal.position.template'].search([('chart_template_id', '=', chart_template_id)])
        tax_template_ref = _get_template_to_real_xmlid_mapping(company, 'account.tax')
        fp_template_ref = _get_template_to_real_xmlid_mapping(company, 'account.fiscal.position')

        tax_template_vals = []
        for position_template in positions:
            fp = env["account.fiscal.position"].browse(fp_template_ref.get(position_template.id))
            if not fp:
                continue
            for position_tax in position_template.tax_ids:
                if position_tax.tax_src_id in new_taxes_template or position_tax.tax_dest_id in new_taxes_template:
                    tax_template_vals.append((position_tax, {
                        'tax_src_id': tax_template_ref[position_tax.tax_src_id.id],
                        'tax_dest_id': position_tax.tax_dest_id and tax_template_ref[position_tax.tax_dest_id.id] or False,
                        'position_id': fp.id,
                    }))
        chart_template._create_records_with_xmlid('account.fiscal.position.tax', tax_template_vals, company)

    def _notify_accountant_managers(taxes_to_check):
        accountant_manager_group = env.ref("account.group_account_manager")
        partner_managers_ids = accountant_manager_group.users.mapped('partner_id')
        odoobot = env.ref('base.partner_root')
        message_body = _(
            "Please check these taxes. They might be outdated. We did not update them. "
            "Indeed, they do not exactly match the taxes of the original version of the localization module.<br/>"
            "You might want to archive or adapt them.<br/><ul>"
        )
        for account_tax in taxes_to_check:
            message_body += f"<li>{html_escape(account_tax.name)}</li>"
        message_body += "</ul>"
        env['mail.thread'].message_notify(
            subject=_('Your taxes have been updated !'),
            author_id=odoobot.id,
            body=message_body,
            partner_ids=[partner.id for partner in partner_managers_ids],
        )

    env = api.Environment(cr, SUPERUSER_ID, {})
    chart_template_id = env.ref(chart_template_xmlid).id
    companies = env['res.company'].search([('chart_template_id', 'child_of', chart_template_id)])
    outdated_taxes = []
    new_taxes_template = []
    for company in companies:
        template_to_tax = _get_template_to_real_xmlid_mapping(company, 'account.tax')
        templates = env['account.tax.template'].with_context(active_test=False).search([("chart_template_id", "=", chart_template_id)])
        for template in templates:
            tax = env["account.tax"].browse(template_to_tax.get(template.id))
            if not tax or not _is_tax_and_template_same(template, tax):
                _create_tax_from_template(company, template, old_tax=tax)
                if tax:
                    outdated_taxes.append(tax)
                else:
                    new_taxes_template.append(template)
            else:
                _update_tax_from_template(template, tax)
        _update_fiscal_positions_from_templates(company, chart_template_id, new_taxes_template)
    if outdated_taxes:
        _notify_accountant_managers(outdated_taxes)

#  ---------------------------------------------------------------
#   Account Templates: Account, Tax, Tax Code and chart. + Wizard
#  ---------------------------------------------------------------
=======
        cr.execute("update ir_model_data set noupdate = 't' where id in %s", [tuple(xml_records.ids)])

def update_taxes_from_templates(cr, chart_template_xmlid):
    def _create_tax_from_template(company, template, old_tax=None):
        """
        Create a new tax from template with template xmlid, if there was already an old tax with that xmlid we
        remove the xmlid from it but don't modify anything else.
        """
        def _remove_xml_id(xml_id):
            module, name = xml_id.split(".", 1)
            env['ir.model.data'].search([('module', '=', module), ('name', '=', name)]).unlink()

        def _avoid_name_conflict():
            conflict_tax = env['account.tax'].search([('name', '=', template.name), ('company_id', '=', company.id),
                                                      ('type_tax_use', '=', template.type_tax_use), ('tax_scope', '=', template.tax_scope)])
            if conflict_tax:
                conflict_tax.name = "[old] " + conflict_tax.name

        template_vals = template._get_tax_vals_complete(company)
        chart_template = env["account.chart.template"].with_context(default_company_id=company.id)
        if old_tax:
            xml_id = old_tax.get_external_id().get(old_tax.id)
            if xml_id:
                _remove_xml_id(xml_id)
        _avoid_name_conflict()
        chart_template.create_record_with_xmlid(company, template, "account.tax", template_vals)

    def _update_tax_from_template(template, tax):
        # -> update the tax : we only updates tax tags
        tax_rep_lines = tax.invoice_repartition_line_ids + tax.refund_repartition_line_ids
        template_rep_lines = template.invoice_repartition_line_ids + template.refund_repartition_line_ids
        for tax_line, template_line in zip(tax_rep_lines, template_rep_lines):
            tags_to_add = template_line._get_tags_to_add()
            tags_to_unlink = tax_line.tag_ids
            if tags_to_add != tags_to_unlink:
                tax_line.write({"tag_ids": [(6, 0, tags_to_add.ids)]})
                _cleanup_tags(tags_to_unlink)

    def _get_template_to_real_xmlid_mapping(company, model):
        """
        This function uses ir_model_data to return a mapping between the templates and the data, using their xmlid
        :returns: {
            account.tax.template.id: account.tax.id
            }
        """
        env['ir.model.data'].flush_model()
        env.cr.execute(
            """
            SELECT template.res_id AS template_res_id,
                   data.res_id AS data_res_id
            FROM ir_model_data data
            JOIN ir_model_data template
            ON template.name = substr(data.name, strpos(data.name, '_') + 1)
            WHERE data.model = %s
            AND data.name LIKE %s
            -- tax.name is of the form: {company_id}_{account.tax.template.name}
            """,
            [model, r"%s\_%%" % company.id],
        )
        tuples = env.cr.fetchall()
        return dict(tuples)

    def _is_tax_and_template_same(template, tax):
        """
        This function compares account.tax and account.tax.template repartition lines.
        A tax is considered the same as the template if they have the same:
            - amount_type
            - amount
            - repartition lines percentages in the same order
        """
        tax_rep_lines = tax.invoice_repartition_line_ids + tax.refund_repartition_line_ids
        template_rep_lines = template.invoice_repartition_line_ids + template.refund_repartition_line_ids
        return (
                tax.amount_type == template.amount_type
                and tax.amount == template.amount
                and len(tax_rep_lines) == len(template_rep_lines)
                and all(
                    rep_line_tax.factor_percent == rep_line_template.factor_percent
                    for rep_line_tax, rep_line_template in zip(tax_rep_lines, template_rep_lines)
                )
        )

    def _cleanup_tags(tags):
        """
        Checks if the tags are still used in taxes or move lines. If not we delete it.
        """
        for tag in tags:
            tax_using_tag = env['account.tax.repartition.line'].sudo().search([('tag_ids', 'in', tag.id)], limit=1)
            aml_using_tag = env['account.move.line'].sudo().search([('tax_tag_ids', 'in', tag.id)], limit=1)
            report_expr_using_tag = tag._get_related_tax_report_expressions()
            if not (aml_using_tag or tax_using_tag or report_expr_using_tag):
                tag.unlink()

    def _update_fiscal_positions_from_templates(company, chart_template_id, new_taxes_template):
        chart_template = env["account.chart.template"].browse(chart_template_id)
        positions = env['account.fiscal.position.template'].search([('chart_template_id', '=', chart_template_id)])
        tax_template_ref = _get_template_to_real_xmlid_mapping(company, 'account.tax')
        fp_template_ref = _get_template_to_real_xmlid_mapping(company, 'account.fiscal.position')

        tax_template_vals = []
        for position_template in positions:
            fp = env["account.fiscal.position"].browse(fp_template_ref.get(position_template.id))
            if not fp:
                continue
            for position_tax in position_template.tax_ids:
                src_id = tax_template_ref[position_tax.tax_src_id.id]
                dest_id = position_tax.tax_dest_id and tax_template_ref[position_tax.tax_dest_id.id] or False
                position_tax_template_exist = fp.tax_ids.filtered_domain([
                    ('tax_src_id', '=', src_id),
                    ('tax_dest_id', '=', dest_id)
                ])
                if not position_tax_template_exist and (position_tax.tax_src_id in new_taxes_template or position_tax.tax_dest_id in new_taxes_template):
                    tax_template_vals.append((position_tax, {
                        'tax_src_id': src_id,
                        'tax_dest_id': dest_id,
                        'position_id': fp.id,
                    }))
        chart_template._create_records_with_xmlid('account.fiscal.position.tax', tax_template_vals, company)

    def _notify_accountant_managers(taxes_to_check):
        accountant_manager_group = env.ref("account.group_account_manager")
        partner_managers_ids = accountant_manager_group.users.mapped('partner_id')
        odoobot = env.ref('base.partner_root')
        message_body = _(
            "Please check these taxes. They might be outdated. We did not update them. "
            "Indeed, they do not exactly match the taxes of the original version of the localization module.<br/>"
            "You might want to archive or adapt them.<br/><ul>"
        )
        for account_tax in taxes_to_check:
            message_body += f"<li>{html_escape(account_tax.name)}</li>"
        message_body += "</ul>"
        env['mail.thread'].message_notify(
            subject=_('Your taxes have been updated !'),
            author_id=odoobot.id,
            body=message_body,
            partner_ids=[partner.id for partner in partner_managers_ids],
        )

    env = api.Environment(cr, SUPERUSER_ID, {})
    chart_template_id = env.ref(chart_template_xmlid).id
    companies = env['res.company'].search([('chart_template_id', 'child_of', chart_template_id)])
    outdated_taxes = []
    new_taxes_template = []
    for company in companies:
        template_to_tax = _get_template_to_real_xmlid_mapping(company, 'account.tax')
        templates = env['account.tax.template'].with_context(active_test=False).search([("chart_template_id", "=", chart_template_id)])
        for template in templates:
            tax = env["account.tax"].browse(template_to_tax.get(template.id))
            if not tax or not _is_tax_and_template_same(template, tax):
                _create_tax_from_template(company, template, old_tax=tax)
                if tax:
                    outdated_taxes.append(tax)
                else:
                    new_taxes_template.append(template)
            else:
                _update_tax_from_template(template, tax)
        _update_fiscal_positions_from_templates(company, chart_template_id, new_taxes_template)
    if outdated_taxes:
        _notify_accountant_managers(outdated_taxes)

#  ---------------------------------------------------------------
#   Account Templates: Account, Tax, Tax Code and chart. + Wizard
#  ---------------------------------------------------------------
>>>>>>> 79ea117593e (temp)


def template(template=None, model='template_data'):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if template is not None:
                # remove the template code argument as we already know it from the decorator
                args, kwargs = args[:1], {}
            return func(*args, **kwargs)
        return api.attrsetter('_l10n_template', (template, model))(wrapper)
    return decorator


class AccountChartTemplate(models.AbstractModel):
    _name = "account.chart.template"
    _description = "Account Chart Template"

    @property
    def _template_register(self):
        def is_template(func):
            return callable(func) and hasattr(func, '_l10n_template')
        template_register = defaultdict(lambda: defaultdict(list))
        cls = type(self)
        for _attr, func in getmembers(cls, is_template):
            template, model = func._l10n_template
            template_register[template][model].append(func)
        cls._template_register = template_register
        return template_register

    def _setup_complete(self):
        super()._setup_complete()
        type(self)._template_register = AccountChartTemplate._template_register


    # --------------------------------------------------------------------------------
    # Template selection
    # --------------------------------------------------------------------------------

    def _get_chart_template_mapping(self, get_all=False):
        """Get basic information about available CoA and their modules.

        :return: a mapping between the template code and a dictionnary constaining the
                 name, country id, country name, module dependencies and parent template
        :rtype: dict[str, dict]
        """
        field = self.env['ir.module.module']._fields['account_templates']
        if self.env.cache.contains_field(field):
            modules = self.env.cache.get_records(self.env['ir.module.module'], field)
        else:
            modules = self.env['ir.module.module'].search([])
        return {
            name: template
            for mapping in modules.mapped('account_templates')
            for name, template in mapping.items()
            if get_all or template['visible']
        }

    def _select_chart_template(self, country=None):
        """Get the available templates in a format suited for Selection fields."""
        country = country if country is not None else self.env.company.country_id
        chart_template_mapping = self._get_chart_template_mapping()
        return [
            (template_code, template['name'])
            for template_code, template in sorted(chart_template_mapping.items(), key=(lambda t: (
                t[1]['name'] != 'generic_coa' if not country
                else t[1]['name'] != 'syscohada' if country.code in SYSCOHADA_LIST
                else t[1]['country_id'] != country.id
            )))
        ]

    def _guess_chart_template(self, country):
        """Guess the most appropriate template based on the country."""
        return self._select_chart_template(country)[0][0]

    # --------------------------------------------------------------------------------
    # Loading
    # --------------------------------------------------------------------------------

    def try_loading(self, template_code, company, install_demo=True):
        """Check if the chart template can be loaded then proceeds installing it.

        :param template_code: code of the chart template to be loaded.
        :type template_code: str
        :param company: the company we try to load the chart template on.
            If not provided, it is retrieved from the context.
        :type company: int, Model<res.company>
        :param install_demo: whether or not we should load demo data right after loading the
            chart template.
        :type install_demo: bool
        """
        if not company:
            company = self.env.company
        if isinstance(company, int):
            company = self.env['res.company'].browse([company])

        template_code = template_code or company and self._guess_chart_template(company.country_id)

        return self._load(template_code, company, install_demo)

    def _load(self, template_code, company, install_demo):
        """Install this chart of accounts for the current company.

        :param template_code: code of the chart template to be loaded.
        :param company: the company we try to load the chart template on.
            If not provided, it is retrieved from the context.
        :param install_demo: whether or not we should load demo data right after loading the
            chart template.
        """
        # Ensure that the context is the correct one, even if not called by try_loading
        if not self.env.is_system():
            raise AccessError(_("Only administrators can install chart templates"))

        module_name = self._get_chart_template_mapping()[template_code].get('module')
        module = self.env['ir.module.module'].search([('name', '=', module_name), ('state', '=', 'uninstalled')])
        if module:
            module.button_immediate_install()
            self.env.reset()  # clear the envs with an old registry
            self = self.env()['account.chart.template']  # create a new env with the new registry

        self = self.with_context(
            default_company_id=company.id,
            allowed_company_ids=[company.id],
            tracking_disable=True,
            delay_account_group_sync=True,
        )
        company = company.with_env(self.env)

        reload_template = template_code == company.chart_template
        company.chart_template = template_code

        if not reload_template:
            for model in ('account.move',) + TEMPLATE_MODELS[::-1]:
                self.env[model].search([('company_id', '=', company.id)]).with_context({MODULE_UNINSTALL_FLAG: True}).unlink()

        data = self._get_chart_template_data(template_code)
        template_data = data.pop('template_data')

        if reload_template:
            self._pre_reload_data(company, template_data, data)
            install_demo = False
        data = self._pre_load_data(template_code, company, template_data, data)
        self._load_data(data)
        self._post_load_data(template_code, company, template_data)

        # Manual sync because disable above (delay_account_group_sync)
        AccountGroup = self.env['account.group'].with_context(delay_account_group_sync=False)
        AccountGroup._adapt_accounts_for_account_groups(self.env['account.account'].search([]))
        AccountGroup.search([])._adapt_parent_account_group()

        # Install the demo data when the first localization is instanciated on the company
        if install_demo and self.ref('base.module_account').demo and not reload_template:
            try:
                with self.env.cr.savepoint():
                    self._load_data(self._get_demo_data(company))
                    self._post_load_demo_data(company)
            except Exception:
                # Do not rollback installation of CoA if demo data failed
                _logger.exception('Error while loading accounting demo data')

    def _pre_reload_data(self, company, template_data, data):
        """Pre-process the data in case of reloading the chart of accounts.

        When we reload the chart of accounts, we only want to update fields that are main
        configuration, like:
        - tax tags
        - fiscal position mappings linked to new records
        """
        for prop in list(template_data):
            if prop.startswith('property_'):
                template_data.pop(prop)
        data.pop('account.reconcile.model', None)

        for xmlid, journal_data in list(data.get('account.journal', {}).items()):
            if self.ref(xmlid, raise_if_not_found=False):
                del data['account.journal'][xmlid]
            elif 'code' in journal_data:
                journal = self.env['account.journal'].search([
                    ('code', '=', journal_data['code']),
                    ('company_id', '=', company.id),
                ])
                if journal:
                    del data['account.journal'][xmlid]
                    self.env['ir.model.data']._update_xmlids([{
                        'xml_id': f"account.{company.id}_{xmlid}",
                        'record': journal,
                        'noupdate': True,
                    }])

        current_taxes = self.env['account.tax'].search([('company_id', '=', company.id)])
        unique_tax_name_key = lambda t: (t.name, t.type_tax_use, t.tax_scope, t.company_id)
        unique_tax_name_keys = set(current_taxes.mapped(unique_tax_name_key))
        xmlid2tax = {
            xml_id.split('.')[1].split('_', maxsplit=1)[1]: self.env['account.tax'].browse(record)
            for record, xml_id in current_taxes.get_external_id().items()
        }
        def tax_template_changed(tax, template):
            return (
                tax.amount_type != template.get('amount_type', 'percent')
                or tax.amount != template.get('amount', 0)
            )

        obsolete_xmlid = set()
        for model_name, records in data.items():
            _fields = self.env[model_name]._fields
            for xmlid, values in records.items():
                x2manyfields = [
                    fname
                    for fname in values
                    if fname in _fields
                    and _fields[fname].type in ('one2many', 'many2many')
                    and isinstance(values[fname], (list, tuple))
                ]
                if x2manyfields:
                    rec = self.ref(xmlid, raise_if_not_found=False)
                    if rec:
                        for fname in x2manyfields:
                            for i, (line, vals) in enumerate(zip(rec[fname], values[fname])):
                                values[fname][i] = Command.update(line.id, vals[2])

                if model_name == 'account.fiscal.position':
                    # Only add tax mappings containing new taxes
                    values['tax_ids'] = [
                        (command, id, vals)
                        for command, id, vals in values.get('tax_ids', [])
                        if (
                            command not in (Command.UPDATE, Command.CREATE)
                            or not self.ref(vals['tax_src_id'], raise_if_not_found=False)
                            or not self.ref(vals['tax_dest_id'], raise_if_not_found=False)
                        )
                    ]
                elif model_name == 'account.tax':
                    # Only update the tags of existing taxes
                    if xmlid not in xmlid2tax or tax_template_changed(xmlid2tax[xmlid], values):
                        if xmlid in xmlid2tax:
                            obsolete_xmlid.add(xmlid)
                            oldtax = xmlid2tax[xmlid]
                            if unique_tax_name_key(oldtax) in unique_tax_name_keys:
                                oldtax.name = f"[old] {oldtax.name}"
                    else:
                        repartition_lines = values.get('repartition_line_ids')
                        values.clear()
                        if repartition_lines:
                            values['repartition_line_ids'] = repartition_lines
                            for _c, _id, repartition_line in values.get('repartition_line_ids', []):
                                tags = repartition_line.get('tag_ids')
                                repartition_line.clear()
                                if tags:
                                    repartition_line['tag_ids'] = tags

        if obsolete_xmlid:
            self.env['ir.model.data'].search([
                ('name', 'in', [f"{company.id}_{xmlid}" for xmlid in obsolete_xmlid]),
                ('module', '=', 'account'),
            ]).unlink()

    def _pre_load_data(self, template_code, company, template_data, data):
        """Pre-process the data and preload some values.

        Some of the data needs special pre_process before being fed to the database.
        e.g. the account codes' width must be standardized to the code_digits applied.
        The fiscal country code must be put in place before taxes are generated.
        """
        if 'account_fiscal_country_id' in data['res.company'][company.id]:
            fiscal_country = self.ref(data['res.company'][company.id]['account_fiscal_country_id'])
        else:
            fiscal_country = company.account_fiscal_country_id

        # Apply template data to the company
        filter_properties = lambda key: (
            (not key.startswith("property_") or key.startswith("property_stock_") or key == "additional_properties")
            and key != 'name'
            and key in company._fields
        )

        # Set the currency to the fiscal country's currency
        vals = {key: val for key, val in template_data.items() if filter_properties(key)}
        vals['currency_id'] = fiscal_country.currency_id.id
        if not company.country_id:
            vals['country_id'] = fiscal_country.id

        # This write method is important because it's overridden and has additional triggers
        # e.g it activates the currency
        company.write(vals)

        # Normalize the code_digits of the accounts
        code_digits = int(template_data.get('code_digits', 6))
        for key, account_data in data.get('account.account', {}).items():
            data['account.account'][key]['code'] = f'{account_data["code"]:<0{code_digits}}'

        for model in ('account.fiscal.position', 'account.reconcile.model'):
            if model in data:
                data[model] = data.pop(model)

        return data

    def _load_data(self, data):
        """Load all the data linked to the template into the database.

        The data can contain translation values (i.e. `name@fr_FR` to translate the name in French)
        An xml_id tht doesn't contain a `.` will be treated as being linked to `account` and prefixed
        with the company's id (i.e. `cash` is interpreted as `account.1_cash` if the company's id is 1)

        :param data: Basically all the final data of records to create/update for the chart
                     of accounts. It is a mapping {model: {xml_id: values}}.
        :type data: dict[str, dict[(str, int), dict]]
        """
        def deref(values, model):
            """Replace xml_id references by database ids.

            This allows to define all the data before the records even exist in the database.
            """
            fields = ((model._fields[k], k, v) for k, v in values.items() if k in model._fields)
            for field, fname, value in fields:
                if not value:
                    values[fname] = False
                elif isinstance(value, str) and (
                    field.type == 'many2one'
                    or (field.type in ('integer', 'many2one_reference') and not value.isdigit())
                ):
                    values[fname] = self.ref(value).id if value not in ('', 'False', 'None') else False
                elif field.type in ('one2many', 'many2many') and isinstance(value[0], (list, tuple)):
                    for i, (command, _id, *last_part) in enumerate(value):
                        if last_part:
                            last_part = last_part[0]
                        # (0, 0, {'test': 'account.ref_name'}) -> Command.Create({'test': 13})
                        if command in (Command.CREATE, Command.UPDATE):
                            deref(last_part, self.env[field.comodel_name])
                        # (6, 0, ['account.ref_name']) -> Command.Set([13])
                        elif command == Command.SET:
                            for subvalue_idx, subvalue in enumerate(last_part):
                                if isinstance(subvalue, str):
                                    last_part[subvalue_idx] = self.ref(subvalue).id
                        elif command == Command.LINK and isinstance(_id, str):
                            value[i] = Command.link(self.ref(_id).id)
                elif field.type in ('one2many', 'many2many') and isinstance(value, str):
                    values[fname] = [Command.set([
                        self.ref(v).id
                        for v in value.split(',')
                        if v
                    ])]
            return values

        def defer(all_data):
            """Defer writing some relations if the related records don't exist yet."""
            created_models = set()
            while all_data:
                (model, data), *all_data = all_data
                to_delay = defaultdict(dict)
                for xml_id, vals in data.items():
                    to_be_removed = []
                    for field_name in vals:
                        field = self.env[model]._fields.get(field_name, None)
                        if (field and
                            field.relational and
                            field.comodel_name not in created_models and
                            (field.comodel_name in dict(all_data) or field.comodel_name == model)
                        ):
                            to_be_removed.append(field_name)
                            to_delay[xml_id][field_name] = vals.get(field_name)
                    for field_name in to_be_removed:
                        del vals[field_name]
                if any(to_delay.values()):
                    all_data.append((model, to_delay))
                yield model, data
                created_models.add(model)

        created_vals = {}
        for model, data in defer(list(data.items())):
            translate_vals = []
            create_vals = []

            for xml_id, record in data.items():
                # Extract the translations from the values
                if any('@' in key for key in record):
                    translate_vals.append({
                        translate.split('@')[1]: value
                        for translate, value in record.items()
                        if '@' in translate and value
                    })
                    translate_vals[-1]['en_US'] = record['name']
                else:
                    translate_vals.append(None)
                for key in list(record):
                    if '@' in key:
                        del record[key]

                # Manage ids given as database id or xml_id
                if isinstance(xml_id, int):
                    record['id'] = xml_id
                    xml_id = False
                else:
                    xml_id = f"{('account.' + str(self.env.company.id) + '_') if '.' not in xml_id else ''}{xml_id}"

                create_vals.append({
                    'xml_id': xml_id,
                    'values': deref(record, self.env[model]),
                    'noupdate': True,
                })
            created_vals[model] = created = self.env[model]._load_records(create_vals)

            # Update the translations in batch for all languages
            translate_vals = [(r.id, Json(t)) for t, r in zip(translate_vals, created) if t]
            if translate_vals:
                self.env.cr.execute(f"""
                    UPDATE "{self.env[model]._table}" AS m
                    SET "name" =  t.value
                    FROM (
                        VALUES {', '.join(['(%s, %s::jsonb)'] * (len(translate_vals)))}
                    ) AS t(id, value)
                    WHERE m.id = t.id
                """, [v for vals in translate_vals for v in vals])
        return created_vals

    def _post_load_data(self, template_code, company, template_data):
        company = (company or self.env.company)
        additional_properties = template_data.pop('additional_properties', {})

        self._setup_utility_bank_accounts(template_code, company, template_data)

        # Unaffected earnings account on the company (if not present yet)
        company.get_unaffected_earnings_account()

        # Set newly created Cash difference and Suspense accounts to the Cash and Bank journals
        for journal in [self.ref(kind, raise_if_not_found=False) for kind in ('bank', 'cash')]:
            if journal:
                journal.suspense_account_id = journal.suspense_account_id or company.account_journal_suspense_account_id
                journal.profit_account_id = journal.profit_account_id or company.default_cash_difference_income_account_id
                journal.loss_account_id = journal.loss_account_id or company.default_cash_difference_expense_account_id

        # Set newly created journals as defaults for the company
        if not company.tax_cash_basis_journal_id:
            company.tax_cash_basis_journal_id = self.ref('caba')
        if not company.currency_exchange_journal_id:
            company.currency_exchange_journal_id = self.ref('exch')

        # Setup default Income/Expense Accounts on Sale/Purchase journals
        sale_journal = self.ref("sale", raise_if_not_found=False)
        if sale_journal and template_data.get('property_account_income_categ_id'):
            sale_journal.default_account_id = self.ref(template_data.get('property_account_income_categ_id'))
        purchase_journal = self.ref("purchase", raise_if_not_found=False)
        if purchase_journal and template_data.get('property_account_expense_categ_id'):
            purchase_journal.default_account_id = self.ref(template_data.get('property_account_expense_categ_id'))

        # Set default Purchase and Sale taxes on the company
        if not company.account_sale_tax_id:
            company.account_sale_tax_id = self.env['account.tax'].search([
                ('type_tax_use', 'in', ('sale', 'all')), ('company_id', '=', company.id)], limit=1).id
        if not company.account_purchase_tax_id:
            company.account_purchase_tax_id = self.env['account.tax'].search([
                ('type_tax_use', 'in', ('purchase', 'all')), ('company_id', '=', company.id)], limit=1).id
        # Display caba fields if there are caba taxes
        if self.env['account.tax'].search([('tax_exigibility', '=', 'on_payment')]):
            company.tax_exigibility = True

        for field, model in {
            **additional_properties,
            'property_account_receivable_id': 'res.partner',
            'property_account_payable_id': 'res.partner',
            'property_account_expense_categ_id': 'product.category',
            'property_account_income_categ_id': 'product.category',
            'property_account_expense_id': 'product.template',
            'property_account_income_id': 'product.template',
            'property_stock_journal': 'product.category',
            'property_stock_account_input_categ_id': 'product.category',
            'property_stock_account_output_categ_id': 'product.category',
            'property_stock_valuation_account_id': 'product.category',
        }.items():
            value = template_data.get(field)
            if value and field in self.env[model]._fields:
                self.env['ir.property']._set_default(field, model, self.ref(value).id, company=company)

    def _get_chart_template_data(self, template_code):
        template_data = defaultdict(lambda: defaultdict(dict))
        template_data['res.company']
        for code in [None] + self._get_parent_template(template_code):
            for model, funcs in sorted(
                self._template_register[code].items(),
                key=lambda i: TEMPLATE_MODELS.index(i[0]) if i[0] in TEMPLATE_MODELS else 1000
            ):
                for func in funcs:
                    data = func(self, template_code)
                    if data is not None:
                        if model == 'template_data':
                            template_data[model].update(data)
                        else:
                            for xmlid, record in data.items():
                                template_data[model][xmlid].update(record)
        return template_data

    def _setup_utility_bank_accounts(self, template_code, company, template_data):
        """Define basic bank accounts for the company.

        - Suspense Account
        - Outstanding Receipts/Payments Accounts
        - Cash Difference Gain/Loss Accounts
        - Liquidity Transfer Account
        """
        # Create utility bank_accounts
        bank_prefix = company.bank_account_code_prefix
        code_digits = int(template_data.get('code_digits', 6))
        accounts_data = {
            'account_journal_suspense_account_id': {
                'name': _("Bank Suspense Account"),
                'prefix': bank_prefix,
                'code_digits': code_digits,
                'account_type': 'asset_current',
            },
            'account_journal_payment_debit_account_id': {
                'name': _("Outstanding Receipts"),
                'prefix': bank_prefix,
                'code_digits': code_digits,
                'account_type': 'asset_current',
                'reconcile': True,
            },
            'account_journal_payment_credit_account_id': {
                'name': _("Outstanding Payments"),
                'prefix': bank_prefix,
                'code_digits': code_digits,
                'account_type': 'asset_current',
                'reconcile': True,
            },
            'account_journal_early_pay_discount_loss_account_id': {
                'name': _("Cash Discount Loss"),
                'code': '999998',
                'account_type': 'expense',
            },
            'account_journal_early_pay_discount_gain_account_id': {
                'name': _("Cash Discount Gain"),
                'code': '999997',
                'account_type': 'income_other',
            },
            'default_cash_difference_income_account_id': {
                'name': _("Cash Difference Gain"),
                'prefix': '999',
                'code_digits': code_digits,
                'account_type': 'expense',
                'tag_ids': [(6, 0, self.ref('account.account_tag_investing').ids)],
            },
            'default_cash_difference_expense_account_id': {
                'name': _("Cash Difference Loss"),
                'prefix': '999',
                'code_digits': code_digits,
                'account_type': 'expense',
                'tag_ids': [(6, 0, self.ref('account.account_tag_investing').ids)],
            },
            'transfer_account_id': {
                'name': _("Liquidity Transfer"),
                'prefix': company.transfer_account_code_prefix,
                'code_digits': code_digits,
                'account_type': 'asset_current',
                'reconcile': True,
            },
        }

        for fname in list(accounts_data):
            if company[fname]:
                del accounts_data[fname]

        accounts = self.env['account.account'].create(accounts_data.values())
        for company_attr_name, account in zip(accounts_data.keys(), accounts):
            company[company_attr_name] = account

    # --------------------------------------------------------------------------------
    # Root template functions
    # --------------------------------------------------------------------------------

    @template(model='account.account')
    def _get_account_account(self, template_code):
        return self._parse_csv(template_code, 'account.account')

    @template(model='account.group')
    def _get_account_group(self, template_code):
        return self._parse_csv(template_code, 'account.group')

    @template(model='account.tax.group')
    def _get_account_tax_group(self, template_code):
        return self._parse_csv(template_code, 'account.tax.group')

    @template(model='account.tax')
    def _get_account_tax(self, template_code):
        tax_data = self._parse_csv(template_code, 'account.tax')
        self._deref_account_tags(template_code, tax_data)
        return tax_data

    @template(model='account.fiscal.position')
    def _get_account_fiscal_position(self, template_code):
        return self._parse_csv(template_code, 'account.fiscal.position')

    @template(model='account.journal')
    def _get_account_journal(self, template_code):
        return {
            "sale": {
                'name': _('Customer Invoices'),
                'type': 'sale',
                'code': _('INV'),
                'show_on_dashboard': True,
                'color': 11,
                'sequence': 5,
            },
            "purchase": {
                'name': _('Vendor Bills'),
                'type': 'purchase',
                'code': _('BILL'),
                'show_on_dashboard': True,
                'color': 11,
                'sequence': 6,
            },
            "general": {
                'name': _('Miscellaneous Operations'),
                'type': 'general',
                'code': _('MISC'),
                'show_on_dashboard': True,
                'sequence': 7,
            },
            "exch": {
                'name': _('Exchange Difference'),
                'type': 'general',
                'code': _('EXCH'),
                'show_on_dashboard': False,
                'sequence': 9,
            },
            "caba": {
                'name': _('Cash Basis Taxes'),
                'type': 'general',
                'code': _('CABA'),
                'show_on_dashboard': False,
                'sequence': 10,
            },
            "bank": {
                'name': _('Bank'),
                'type': 'bank',
                'show_on_dashboard': True,
            },
            "cash": {
                'name': _('Cash'),
                'type': 'cash',
                'show_on_dashboard': True,
            },
        }

    @template(model='account.reconcile.model')
    def _get_account_reconcile_model(self, template_code):
        return {
            "reconcile_perfect_match": {
                "name": _('Invoices/Bills Perfect Match'),
                "sequence": 1,
                "rule_type": 'invoice_matching',
                "auto_reconcile": True,
                "match_nature": 'both',
                "match_same_currency": True,
                "allow_payment_tolerance": True,
                "payment_tolerance_type": 'percentage',
                "payment_tolerance_param": 0,
                "match_partner": True,
            },
            "reconcile_partial_underpaid": {
                "name": _('Invoices/Bills Partial Match if Underpaid'),
                "sequence": 2,
                "rule_type": 'invoice_matching',
                "auto_reconcile": False,
                "match_nature": 'both',
                "match_same_currency": True,
                "allow_payment_tolerance": False,
                "match_partner": True,
            }
        }

    # --------------------------------------------------------------------------------
    # Tooling
    # --------------------------------------------------------------------------------

    def ref(self, xmlid, raise_if_not_found=True):
        return self.env.ref(f"account.{self.env.company.id}_{xmlid}" if xmlid and '.' not in xmlid else xmlid, raise_if_not_found)

    def _get_parent_template(self, code):
        parents = []
        template_mapping = self._get_chart_template_mapping(get_all=True)
        while template_mapping.get(code):
            parents.append(code)
            code = template_mapping.get(code).get('parent')
        return parents

    def _get_tag_mapper(self, template_code):
        tags = {x.name: x.id for x in self.env['account.account.tag'].search([
            ('applicability', '=', 'taxes'),
            ('country_id', '=', self._get_chart_template_mapping()[template_code]['country_id']),
        ])}
        return lambda *args: [tags[re.sub(r'\s+', ' ', x.strip())] for x in args]

    def _deref_account_tags(self, template_code, tax_data):
        mapper = self._get_tag_mapper(template_code)
        for tax in tax_data.values():
            for fname in ('invoice_repartition_line_ids', 'refund_repartition_line_ids', 'repartition_line_ids'):
                if tax.get(fname):
                    for _command, _id, repartition in tax[fname]:
                        tags = repartition.get('tag_ids')
                        if isinstance(tags, str) and not re.match(r"^(\w+\.\w+,)*\w+\.\w+$", tags):
                            repartition['tag_ids'] = [Command.set(mapper(*tags.split(TAX_TAG_DELIMITER)))]

    def _parse_csv(self, template_code, model, module=None):
        Model = self.env[model]
        model_fields = Model._fields

        if module is None:
            module = self._get_chart_template_mapping().get(template_code)['module']
        assert re.fullmatch(r"[a-z0-9_]+", module)

        res = {}
        for template in self._get_parent_template(template_code)[::-1] or ['']:
            try:
                with file_open(f"{module}/data/template/{model}{f'-{template}' if template else ''}.csv", 'r') as csv_file:
                    for row in csv.DictReader(csv_file):
                        if row['id']:
                            last_id = row['id']
                            res[row['id']] = {
                                key.split('/')[0]: (
                                    value if '@' in key
                                    else [] if '/' in key
                                    else (value and ast.literal_eval(value) or False) if model_fields[key].type in ('boolean', 'int', 'float')
                                    else value
                                )
                                for key, value in row.items()
                                if key != 'id' and value != ""
                            }
                        create_added = set()
                        for key, value in row.items():
                            if '/' in key and value:
                                sub = [Command.create(res[last_id])]
                                path = key.split('/')
                                for p in path[:-1]:
                                    if p not in create_added:
                                        create_added.add(p)
                                        sub[-1][2].setdefault(p, [])
                                        sub[-1][2][p].append(Command.create({}))
                                    sub = sub[-1][2][p]
                                sub[-1][2][path[-1]] = value
            except FileNotFoundError:
                _logger.debug("No file %s found for template '%s'", model, module)
        return res
