# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from itertools import product

from odoo import Command, api, models
from .eu_account_map import EU_ACCOUNT_MAP
from .eu_tag_map import EU_TAG_MAP
from .eu_tax_map import EU_TAX_MAP


def group_xmlid(company, tax_amount):
    return f"account.{company.id}_oss_tax_group_{str(tax_amount).replace('.', '_')}_{company.account_fiscal_country_id.code}"


class Company(models.Model):
    _inherit = 'res.company'

    @api.model
    def _map_all_eu_companies_taxes(self):
        ''' Identifies EU companies and calls the _map_eu_taxes function
        '''
        eu_countries = self.env.ref('base.europe').country_ids
        companies = self.search([('account_fiscal_country_id', 'in', eu_countries.ids)])
        companies._map_eu_taxes()

    def _map_eu_taxes(self):
        '''Creates or updates Fiscal Positions for each EU country excluding the company's account_fiscal_country_id
        '''
        eu_countries = self.env.ref('base.europe').country_ids
        oss_tax_groups = self.env['ir.model.data'].search([
            ('module', '=', 'l10n_eu_oss'),
            ('model', '=', 'account.tax.group')])
        for company in self.root_id:  # instantiate OSS taxes on the root company only
            invoice_repartition_lines, refund_repartition_lines = company._get_repartition_lines_oss()
            oss_countries = eu_countries - company.account_fiscal_country_id - company.account_foreign_fiscal_position_ids.country_id

            taxes = self.env['account.tax'].search([
                *self.env['account.tax']._check_company_domain(company),
                ('type_tax_use', '=', 'sale'),
                ('amount_type', '=', 'percent'),
                ('country_id', '=', company.account_fiscal_country_id.id),
                ('tax_group_id', 'not in', oss_tax_groups.mapped('res_id'))])

            any_tax_group = self.env['account.tax.group'].search([
                *self.env['account.tax.group']._check_company_domain(company),
                ('tax_payable_account_id', '!=', False)
            ], limit=1)

            all_tax_amounts = {
                tax_amount
                for destination_country in oss_countries
                for domestic_tax in taxes
                if (tax_amount := EU_TAX_MAP.get((company.account_fiscal_country_id.code, domestic_tax.amount, destination_country.code), False))
            }

            # Fetch or create Fiscal Positions
            country2fpos = company.fiscal_position_ids.filtered(lambda fpos:
                fpos.auto_apply
                and not fpos.vat_required
                and not fpos.foreign_vat
            ).grouped('country_id')
            country2fpos.update(self.env['account.fiscal.position'].create([
                {
                    'name': f'OSS B2C {destination_country.name}',
                    'country_id': destination_country.id,
                    'company_id': company.id,
                    'auto_apply': True,
                }
                for destination_country in oss_countries
                if not country2fpos.get(destination_country)
            ]).grouped('country_id'))

            # Fetch or create Tax Groups
            amount2tax_group = {
                amount: tax_group
                for amount in all_tax_amounts
                if (tax_group := self.env.ref(group_xmlid(company, amount), raise_if_not_found=False))
            }
            missing_group_amounts = list(all_tax_amounts - amount2tax_group.keys())
            amount2tax_group.update(zip(missing_group_amounts, self.env['account.tax.group']._load_records([
                {
                    'xml_id': group_xmlid(company, tax_amount),
                    'values': {
                        'name': f'OSS {tax_amount}%',
                        'country_id': company.account_fiscal_country_id.id,
                        'company_id': company.id,
                        'tax_payable_account_id': any_tax_group.tax_payable_account_id.id,
                        'tax_receivable_account_id': any_tax_group.tax_receivable_account_id.id,
                    },
                    'noupdate': True,
                }
                for tax_amount in missing_group_amounts
            ])))

            # Create missing Taxes
            country2amount2foreign_tax = {
                destination_country: {
                    tax.amount: tax
                    for tax in country2fpos[destination_country].tax_ids.tax_dest_id
                    if tax.amount_type == 'percent'
                }
                for destination_country in oss_countries
            }
            country2missing_amounts = {
                destination_country: list({
                    tax_amount
                    for domestic_tax in taxes
                    if (tax_amount := EU_TAX_MAP.get((company.account_fiscal_country_id.code, domestic_tax.amount, destination_country.code), False))
                    and tax_amount not in country2amount2foreign_tax[destination_country]
                })
                for destination_country in oss_countries
            }

            new_taxes_iter = iter(self.env['account.tax'].create([
                {
                    'name': f'{tax_amount}% {destination_country.code} {destination_country.vat_label}',
                    'amount': tax_amount,
                    'invoice_repartition_line_ids': invoice_repartition_lines,
                    'refund_repartition_line_ids': refund_repartition_lines,
                    'type_tax_use': 'sale',
                    'description': f"{tax_amount}%",
                    'tax_group_id': amount2tax_group[tax_amount].id,
                    'country_id': company.account_fiscal_country_id.id,
                    'sequence': 1000,
                    'company_id': company.id,
                }
                for destination_country, tax_amounts in country2missing_amounts.items()
                for tax_amount in tax_amounts
            ]))
            for destination_country, tax_amounts in country2missing_amounts.items():
                for tax_amount in tax_amounts:
                    tax = next(new_taxes_iter)
                    country2amount2foreign_tax[destination_country][tax.amount] = tax
            assert not next(new_taxes_iter, False)

            # Map new Taxes to Fiscal Positions
            for destination_country in oss_countries:
                fpos = country2fpos[destination_country]
                missing_mapping = {
                    domestic_tax: tax_amount
                    for domestic_tax in taxes
                    if (
                        (tax_amount := EU_TAX_MAP.get((company.account_fiscal_country_id.code, domestic_tax.amount, destination_country.code), False))
                        and domestic_tax not in fpos.tax_ids.tax_src_id
                    )
                }
                if missing_mapping:
                    fpos.tax_ids = [
                        Command.create({'tax_src_id': src.id, 'tax_dest_id': country2amount2foreign_tax[destination_country][amount].id})
                        for src, amount in missing_mapping.items()
                    ]

    def _get_repartition_lines_oss(self):
        self.ensure_one()
        oss_account, oss_tags = self._get_oss_account(), self._get_oss_tags()
        repartition_line_ids = {}
        for doc_type, rep_type in product(('invoice', 'refund'), ('base', 'tax')):
            vals = {'document_type': doc_type, 'repartition_type': rep_type, 'tag_ids': [Command.link(tag.id) for tag in oss_tags[f'{doc_type}_{rep_type}_tag']]}
            if oss_account:
                vals['account_id'] = oss_account.id
            repartition_line_ids.setdefault(doc_type, []).append(Command.create(vals))
        return repartition_line_ids['invoice'], repartition_line_ids['refund']

    def _get_oss_account(self):
        self.ensure_one()
        if not (oss_account := self.env.ref(f'l10n_eu_oss.oss_tax_account_company_{self.id}', raise_if_not_found=False)):
            oss_account = self._create_oss_account()
        return oss_account

    def _create_oss_account(self):
        if (
            self.chart_template in EU_ACCOUNT_MAP
            and (oss_account_if_exists :=
                self.env['account.account'].search([
                    ('company_id', '=', self.id),
                    ('code', '=', EU_ACCOUNT_MAP[self.chart_template])
                ])
            )
        ):
            oss_account = oss_account_if_exists
        else:
            sales_tax_accounts = self.env['account.tax'].search([
                    *self.env['account.tax']._check_company_domain(self),
                    ('type_tax_use', '=', 'sale'),
                ]).invoice_repartition_line_ids.mapped('account_id')
            if not sales_tax_accounts:
                return False
            new_code = self.env['account.account']._search_new_account_code(
                sales_tax_accounts[0].code,
                self,
            )
            oss_account = self.env['account.account'].create({
                'name': f'{sales_tax_accounts[0].name} OSS',
                'code': new_code,
                'account_type': sales_tax_accounts[0].account_type,
                'company_id': self.id,
                'tag_ids': [(4, tag.id, 0) for tag in sales_tax_accounts[0].tag_ids],
            })
        self.env['ir.model.data'].create({
            'name': f'oss_tax_account_company_{self.id}',
            'module': 'l10n_eu_oss',
            'model': 'account.account',
            'res_id': oss_account.id,
            'noupdate': True,
        })
        return oss_account

    def _get_oss_tags(self):
        oss_tag = self.env.ref('l10n_eu_oss.tag_oss')
        tag_for_country = EU_TAG_MAP.get(self.chart_template, {
            'invoice_base_tag': None,
            'invoice_tax_tag': None,
            'refund_base_tag': None,
            'refund_tax_tag': None,
        })

        mapping = {}
        for repartition_line_key, tag_xml_id in tag_for_country.items():
            tag = self.env.ref(tag_xml_id) if tag_xml_id else self.env['account.account.tag']
            if tag and tag._name == "account.report.expression":
                tag = tag._get_matching_tags("+")
            mapping[repartition_line_key] = tag + oss_tag

        return mapping
