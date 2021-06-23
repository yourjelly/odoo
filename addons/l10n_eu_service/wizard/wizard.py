# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import Warning


class l10n_eu_service(models.TransientModel):
    """Create fiscal positions for EU Service VAT"""
    _name = "l10n_eu_service.wizard"
    _description = __doc__

    def _get_eu_res_country_group(self):
        eu_group = self.env.ref("base.europe", raise_if_not_found=False)
        if not eu_group:
            raise Warning(_('The Europe country group cannot be found. '
                            'Please update the base module.'))
        return eu_group

    def _get_default_company_id(self):
        return self.env.company.id

    def _default_fiscal_position_id(self):
        user = self.env.user
        eu_id = self._get_eu_res_country_group()
        return self.env['account.fiscal.position'].search(
            [('company_id', '=', user.company_id.id), ('vat_required', '=', True),
             ('country_group_id.id', '=', eu_id.id)], limit=1)

    def _default_tax_id(self):
        user = self.env.user
        return self.env['account.tax'].search(
            [('company_id', '=', user.company_id.id), ('type_tax_use', '=', 'sale'),
             ('amount_type', '=', 'percent')], limit=1, order='amount desc')

    def _default_done_country_ids(self):
        user = self.env.user
        eu_country_group = self._get_eu_res_country_group()
        return eu_country_group.country_ids - self._default_todo_country_ids() - user.company_id.country_id

    def _default_todo_country_ids(self):
        user = self.env.user
        eu_country_group = self._get_eu_res_country_group()
        eu_fiscal = self.env['account.fiscal.position'].search(
            [('country_id', 'in', eu_country_group.country_ids.ids),
             ('vat_required', '=', False), ('auto_apply', '=', True),
             ('company_id', '=', user.company_id.id)])
        return eu_country_group.country_ids - eu_fiscal.mapped('country_id') - user.company_id.country_id - self.env.company.country_id

    company_id = fields.Many2one(
        'res.company', string='Company', required=True, default=_get_default_company_id)
    fiscal_position_id = fields.Many2one(
        'account.fiscal.position', string='Fiscal Position', default=_default_fiscal_position_id,
        help="Optional fiscal position to use as template for general account mapping. "
             "Should usually be your current Intra-EU B2B fiscal position. "
             "If not set, no general account mapping will be configured for EU fiscal positions.")
    tax_id = fields.Many2one(
        'account.tax', string='Service VAT', required=True, default=_default_tax_id,
        help="Select your current VAT tax for services. This is the tax that will be mapped "
             "to the corresponding VAT tax in each EU country selected below.")
    account_collected_id = fields.Many2one(
        "account.account", string="Tax Collection Account",
        help="Optional account to use for collecting tax amounts when selling services in "
             "each EU country selected below. If not set, the current collecting account of "
             "your Service VAT will be used.")
    done_country_ids = fields.Many2many(
        'res.country', 'l10n_eu_service_country_rel_done', default=_default_done_country_ids,
        string='Already Supported')
    todo_country_ids = fields.Many2many(
        'res.country', 'l10n_eu_service_country_rel_todo', default=_default_todo_country_ids,
        string='EU Customers From', required=True)

    tax_ids = fields.Many2many('account.tax', 'l10n_eu_service_tax_rel_todo', required=True, string="Domestic Taxes")
    proposed_tax_ids = fields.Many2many(string="Fiscal Position Preview", comodel_name='l10n_eu_service.wizard.tax', relation='l10n_eu_service_tax_props', compute='_compute_proposed_tax_ids', readonly=False)

    @api.depends('todo_country_ids', 'tax_ids')
    def _compute_proposed_tax_ids(self):
        tax_rate = self.env['l10n_eu_service.service_tax_rate']
        for record in self:
            proposals = []
            for tax in record.tax_ids:
                for country in record.todo_country_ids:
                    rate = tax_rate.search([('country_id', '=', country.id if isinstance(country.id, int) else country.id.origin)]).rate or 0.0
                    values = {
                        # 'name': existing_fps.name or _('OSS B2C %(country)s' % {'country': country.name}),
                        'country_id': country.id if isinstance(country.id, int) else country.id.origin,
                        'map_tax_id': tax.id if isinstance(tax.id, int) else tax.id.origin,
                        # 'apply_tax_id': _('VAT in %(country)s (%(rate)s)' % {'country':country.name, 'rate':rate}),
                        'amount': rate,
                        'account_collected_id': record.account_collected_id,
                    }
                    # res = self.env['l10n_eu_service.wizard.tax'].create(values)
                    # proposals.append([4, res.id])
                    proposals.append([0, 0, values])
            record.proposed_tax_ids = proposals

    def _get_repartition_line_copy_values(self, original_rep_lines):
        return [(0, 0, {
            'factor_percent': line.factor_percent,
            'repartition_type': line.repartition_type,
            'account_id': line.repartition_type == 'tax' and (self.account_collected_id.id or line.account_id.id) or None,
            'company_id': line.company_id.id,
            'sequence': line.sequence,
        }) for line in original_rep_lines]

    def generate_eu_service(self):
        account_tax = self.env['account.tax']
        account_fpos = self.env['account.fiscal.position']
        for record in self.proposed_tax_ids:
            tax = account_tax.search([('name', '=', record.apply_tax_id)])
            if not tax:
                tax = account_tax.create({
                    'name': record.apply_tax_id,
                    'amount': record.amount,
                    'invoice_repartition_line_ids': self._get_repartition_line_copy_values(record.map_tax_id.invoice_repartition_line_ids),
                    'refund_repartition_line_ids': self._get_repartition_line_copy_values(record.map_tax_id.refund_repartition_line_ids),
                    'type_tax_use': 'sale',
                    'description': "%s%%" % record.amount,
                    'sequence': 1000,
                })
            if self.fiscal_position_id:
                account_ids = [(6, 0, self.fiscal_position_id.account_ids.ids)]
            else:
                account_ids = False
            fpos = account_fpos.search([('country_id', '=', record.country_id.id)], limit=1)
            if not fpos:
                fpos = account_fpos.create({
                    'name': record.name,
                    'company_id': self.company_id.id,
                    'vat_required': False,
                    'auto_apply': True,
                    'country_id': record.country_id.id,
                    'account_ids': account_ids,
                    'tax_ids': [(0, 0, {'tax_src_id': record.map_tax_id.id, 'tax_dest_id': tax.id})]
                })
            else:
                fpos.write({
                    'tax_ids': [(0, 0, {'tax_src_id': record.map_tax_id.id, 'tax_dest_id': tax.id})]
                })
        return {'type': 'ir.actions.act_window_close'}
