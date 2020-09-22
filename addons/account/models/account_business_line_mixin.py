# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class AccountBusinessLineMixin(models.AbstractModel):
    _name = 'account.business.line.mixin'
    _description = "Business Lines Helpers"

    # -------------------------------------------------------------------------
    # TO BE OVERRIDDEN METHODS
    # -------------------------------------------------------------------------

    def _get_product(self):
        # TO BE OVERRIDDEN
        return self.env['product.product']

    def _get_product_uom(self):
        # TO BE OVERRIDDEN
        return self.env['uom.uom']

    def _get_taxes(self):
        # TO BE OVERRIDDEN
        return self.env['account.tax']

    def _get_price_unit(self):
        # TO BE OVERRIDDEN
        return None

    def _get_quantity(self):
        # TO BE OVERRIDDEN
        return None

    def _get_discount(self):
        # TO BE OVERRIDDEN
        return None

    def _get_partner(self):
        # TO BE OVERRIDDEN
        return self.env['res.partner']

    def _get_company(self):
        # TO BE OVERRIDDEN
        return self.env['res.company']

    def _get_currency(self):
        # TO BE OVERRIDDEN
        return self.env['res.currency']

    def _get_account(self):
        # TO BE OVERRIDDEN
        return self.env['account.account']

    def _get_analytic_account(self):
        # TO BE OVERRIDDEN
        return self.env['account.analytic.account']

    def _get_analytic_tags(self):
        # TO BE OVERRIDDEN
        return self.env['account.analytic.tag']

    def _get_journal(self):
        # TO BE OVERRIDDEN
        return self.env['account.journal']

    def _get_date(self):
        # TO BE OVERRIDDEN
        return None

    def _get_fiscal_position(self):
        # TO BE OVERRIDDEN
        return self.env['account.fiscal.position']

    def _get_tax_repartition_line(self):
        # TO BE OVERRIDDEN
        return self.env['account.tax.repartition.line']

    def _get_tags(self):
        # TO BE OVERRIDDEN
        return self.env['account.account.tag']

    def _get_document_type(self):
        # TO BE OVERRIDDEN
        return None

    def _is_refund_document(self):
        # TO BE OVERRIDDEN
        return False

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    def _get_default_product_name(self):
        ''' Helper to get the default name of a business line based on the product.
        :return: A string.
        '''
        company = self._get_company()
        if company:
            self = self.with_company(company)

        product = self._get_product()
        partner = self._get_partner()

        if not product:
            return ''

        if partner.lang:
            product = product.with_context(lang=partner.lang)

        values = []
        if product.partner_ref:
            values.append(product.partner_ref)
        if self._get_document_type() == 'sale':
            if product.description_sale:
                values.append(product.description_sale)
        elif self._get_document_type() == 'purchase':
            if product.description_purchase:
                values.append(product.description_purchase)
        return '\n'.join(values)

    def _get_default_product_uom(self):
        ''' Helper to get the default unit of measure of a business line based on the product.
        :return: An uom.uom record or an empty recordset.
        '''
        company = self._get_company()
        if company:
            self = self.with_company(company)

        product = self._get_product()
        return product.uom_id

    def _get_default_product_account(self):
        ''' Helper to get the default accounting account of a business line based on the product.
        :return: An account.account record or an empty recordset.
        '''
        company = self._get_company()
        if company:
            self = self.with_company(company)

        product = self._get_product()
        journal = self._get_journal()
        fiscal_position = self._get_fiscal_position()

        if product:
            accounts = product.product_tmpl_id.get_product_accounts(fiscal_pos=fiscal_position)
            if self._get_document_type() == 'sale':
                account = accounts['income']
            elif self._get_document_type() == 'purchase':
                account = accounts['expense']
            else:
                account = self.env['account.account']
        else:
            account = self.env['account.account']

        if not account and journal:
            account = journal.default_account_id

        return account

    def _get_default_product_taxes(self):
        ''' Helper to get the default taxes of a business line based on the product.
        :return: An account.tax recordset.
        '''
        company = self._get_company()
        if company:
            self = self.with_company(company)

        product = self._get_product()
        company = self._get_company()
        fiscal_position = self._get_fiscal_position()
        partner = self._get_partner()
        account = self._get_account()

        if self._get_document_type() == 'sale':
            taxes = product.taxes_id
        elif self._get_document_type() == 'purchase':
            taxes = product.supplier_taxes_id
        else:
            taxes = self.env['account.tax']

        if company:
            taxes = taxes.filtered(lambda tax: tax.company_id == company)

        if not taxes:
            taxes = account.tax_ids

        if not taxes:
            if self._get_document_type() == 'sale':
                taxes = company.account_sale_tax_id
            elif self._get_document_type() == 'purchase':
                taxes = company.account_purchase_tax_id

        if taxes and fiscal_position:
            taxes = fiscal_position.map_tax(taxes, partner=partner)

        return taxes

    def _get_default_product_price_unit(self):
        ''' Helper to get the default price unit of a business line based on the product.
        :return: The price unit.
        '''
        company = self._get_company()
        if company:
            self = self.with_company(company)

        product = self._get_product()
        partner = self._get_partner()
        uom = self._get_product_uom()
        product_uom = self._get_default_product_uom()
        currency = self._get_currency()
        company = self._get_company()
        product_currency = product.company_id.currency_id or company.currency_id
        fiscal_position = self._get_fiscal_position()
        is_refund_document = self._is_refund_document()
        date = self._get_date()

        if not product:
            return 0.0

        if self._get_document_type() == 'sale':
            price_unit = product.lst_price
            product_taxes = product.taxes_id
        elif self._get_document_type() == 'purchase':
            price_unit = product.standard_price
            product_taxes = product.supplier_taxes_id
        else:
            return 0.0

        if company:
            product_taxes = product_taxes.filtered(lambda tax: tax.company_id == company)

        # Apply unit of measure.
        if uom and uom != product_uom:
            price_unit = product_uom._compute_price(price_unit, uom)

        # Apply fiscal position.
        if product_taxes and fiscal_position:
            product_taxes_after_fp = fiscal_position.map_tax(product_taxes, partner=partner)

            if set(product_taxes.ids) != set(product_taxes_after_fp.ids):
                flattened_taxes = product_taxes._origin.flatten_taxes_hierarchy()
                if any(tax.price_include for tax in flattened_taxes):
                    taxes_res = flattened_taxes.compute_all(
                        price_unit,
                        quantity=1.0,
                        currency=product_currency,
                        product=product,
                        partner=partner,
                        is_refund=is_refund_document,
                    )
                    price_unit = product_currency.round(taxes_res['total_excluded'])

                flattened_taxes = product_taxes_after_fp._origin.flatten_taxes_hierarchy()
                if any(tax.price_include for tax in flattened_taxes):
                    taxes_res = flattened_taxes.compute_all(
                        price_unit,
                        quantity=1.0,
                        currency=product_currency,
                        product=product,
                        partner=partner,
                        is_refund=is_refund_document,
                        handle_price_include=False,
                    )
                    for tax_res in taxes_res['taxes']:
                        tax = self.env['account.tax'].browse(tax_res['id'])
                        if tax.price_include:
                            price_unit += tax_res['amount']

        # Apply currency rate.
        if currency and currency != product_currency and date:
            price_unit = product_currency._convert(price_unit, currency, company, date)

        return price_unit

    def _get_price_unit_without_discount(self):
        ''' Helper to get the default price unit reduced by the discount amount of a business line based on the product.
        :return: The price unit minus the discount.
        '''
        company = self._get_company()
        if company:
            self = self.with_company(company)

        price_unit = self._get_price_unit()
        discount = self._get_discount()

        if price_unit is None:
            return None

        if discount is None:
            return price_unit
        else:
            return price_unit * (1 - (discount / 100.0))

    @api.model
    def _get_default_tax_account(self, repartition_line):
        ''' Helper to get the default tax account to be set on tax line.
        :return: An account.account record or an empty recordset.
        '''
        tax = repartition_line.invoice_tax_id or repartition_line.refund_tax_id
        if tax.tax_exigibility == 'on_payment':
            account = tax.cash_basis_transition_account_id
        else:
            account = repartition_line.account_id
        return account

    @api.model
    def _revert_signed_tags(self, tags):
        rslt = self.env['account.account.tag']
        for tag in tags:
            if tag.tax_report_line_ids:
                # tag created by an account.tax.report.line
                new_tag = tag.tax_report_line_ids[0].tag_ids.filtered(lambda x: x.tax_negate != tag.tax_negate)
                rslt += new_tag
            else:
                # tag created in data for use by an account.financial.html.report.line
                rslt += tag

        return rslt

    # -------------------------------------------------------------------------
    # TAXES
    # -------------------------------------------------------------------------

    def _get_tax_grouping_key_from_base_lines(self, tax_vals):
        self.ensure_one()
        tax_repartition_line = self.env['account.tax.repartition.line'].browse(tax_vals['tax_repartition_line_id'])
        account = self._get_default_tax_account(tax_repartition_line) or self._get_account()
        return {
            'tax_repartition_line_id': tax_vals['tax_repartition_line_id'],
            'account_id': account.id,
            'partner_id': self._get_partner().id,
            'currency_id': self._get_currency().id,
            'analytic_tag_ids': [(6, 0, self._get_analytic_tags().ids if tax_vals['analytic'] else [])],
            'analytic_account_id': self._get_analytic_account().id if tax_vals['analytic'] else False,
            'tax_ids': [(6, 0, tax_vals['tax_ids'])],
            'tax_tag_ids': [(6, 0, tax_vals['tag_ids'])],
        }

    def _get_tax_grouping_key_from_tax_line(self):
        self.ensure_one()
        repartition_line = self._get_tax_repartition_line()
        if repartition_line:
            tax = repartition_line.invoice_tax_id or repartition_line.refund_tax_id
        else:
            tax = self.env['account.tax']

        return {
            'tax_repartition_line_id': self._get_tax_repartition_line().id,
            'account_id': self._get_account().id,
            'partner_id': self._get_partner().id,
            'currency_id': self._get_currency().id,
            'analytic_tag_ids': [(6, 0, self._get_analytic_tags().ids if tax.analytic else [])],
            'analytic_account_id': self._get_analytic_account().id if tax.analytic else False,
            'tax_ids': [(6, 0, self._get_taxes().ids)],
            'tax_tag_ids': [(6, 0, self._get_tags().ids)],
        }

    def _compute_diff_taxes(self, tax_lines=[]):
        def _serialize_python_dictionary(dict):
            return '-'.join(str(v) for v in dict.values())

        res = {
            'tax_line_to_add': [],
            'tax_line_to_delete': self.env[tax_lines._name] if tax_lines else [],
            'tax_line_to_update': [],
            'base_line_to_update': [],
            'amount_untaxed': 0.0,
            'amount_tax': 0.0,
            'amount_total': 0.0,
        }
        encountered_currency_ids = set()

        # 1

        existing_tax_line_map = {}
        for line in tax_lines:
            map_key = _serialize_python_dictionary(line._get_tax_grouping_key_from_tax_line())
            if map_key in existing_tax_line_map:
                res['tax_line_to_delete'] |= line
            else:
                existing_tax_line_map[map_key] = line

        # 2

        base_lines = self.filtered(lambda line: not line._get_tax_repartition_line())

        tax_line_to_update_vals_map = {}
        for line in base_lines:
            journal = line._get_journal()
            document_type = line._get_document_type()
            price_unit = line._get_price_unit_without_discount()
            taxes = line._get_taxes()._origin
            currency = line._get_currency()
            quantity = 1.0 if line._get_document_type() == 'misc' else line._get_quantity()

            encountered_currency_ids.add(currency.id)

            if document_type == 'misc':
                # In case of an unspecified document, try to guess if the user is encoding something that looks like
                # a refund or not.
                if journal is None:
                    is_refund_document = False
                else:
                    tax_type = taxes[0].type_tax_use
                    is_refund_document = (journal.type == 'sale' and tax_type == 'sale' and price_unit > 0.0) \
                                         or (journal.type == 'purchase' and tax_type == 'purchase' and price_unit < 0.0)
            else:
                is_refund_document = line._is_refund_document()

            taxes_res = taxes._origin.compute_all(
                price_unit,
                currency=currency,
                quantity=quantity,
                product=line._get_product(),
                partner=line._get_partner(),
                is_refund=is_refund_document,
                handle_price_include=document_type != 'misc',
            )

            if document_type == 'misc':
                tax_type = taxes[0].type_tax_use
                repartition_field = 'refund_repartition_line_ids' if is_refund_document else 'invoice_repartition_line_ids'
                repartition_tags = taxes[repartition_field].filtered(lambda x: x.repartition_type == 'base').tag_ids
                tags_need_inversion = (tax_type == 'sale' and not is_refund_document) or (tax_type == 'purchase' and is_refund_document)
                if tags_need_inversion:
                    taxes_res['base_tags'] = line._revert_signed_tags(repartition_tags).ids
                    for tax_res in taxes_res['taxes']:
                        tax_res['tag_ids'] = line._revert_signed_tags(self.env['account.account.tag'].browse(tax_res['tag_ids'])).ids

            res['amount_untaxed'] += taxes_res['total_excluded'] if taxes else currency.round(price_unit * quantity)

            base_line_to_update_vals = {
                'tax_exigible': True,
                'tax_tag_ids': [(6, 0, taxes_res['base_tags'])],
            }
            for tax_vals in taxes_res['taxes']:
                tax = self.env['account.tax'].browse(tax_vals['id'])
                grouping_dict = line._get_tax_grouping_key_from_base_lines(tax_vals)
                map_key = _serialize_python_dictionary(grouping_dict)

                if tax.tax_exigibility == 'on_payment':
                    base_line_to_update_vals['tax_exigible'] = False

                tax_line_to_update_vals_map.setdefault(map_key, {
                    'existing_tax_line': existing_tax_line_map.pop(map_key, None),
                    'grouping_dict': grouping_dict,
                    'tax_base_amount': 0.0,
                    'amount': 0.0,
                    'tax_exigible': tax.tax_exigibility == 'on_invoice',
                })
                tax_line_to_update_vals_map[map_key]['tax_base_amount'] += tax_vals['base']
                tax_line_to_update_vals_map[map_key]['amount'] += tax_vals['amount']

            res['base_line_to_update'].append((line, base_line_to_update_vals))

        # 3

        for tax_dict in tax_line_to_update_vals_map.values():
            if tax_dict['existing_tax_line']:
                currency = tax_dict['existing_tax_line']._get_currency()
                to_update_vals = {
                    'tax_base_amount': currency.round(tax_dict['tax_base_amount']),
                    'amount': currency.round(tax_dict['amount']),
                    'tax_exigible': tax_dict['tax_exigible'],
                }
                res['tax_line_to_update'].append((tax_dict['existing_tax_line'], to_update_vals))
                res['amount_tax'] += to_update_vals['amount']
                encountered_currency_ids.add(currency.id)
            else:
                currency = self.env['res.currency'].browse(tax_dict['grouping_dict']['currency_id'])
                tax_repartition_line = self.env['account.tax.repartition.line'].browse(tax_dict['grouping_dict']['tax_repartition_line_id'])
                tax = tax_repartition_line.invoice_tax_id or tax_repartition_line.refund_tax_id
                new_vals = {
                    **tax_dict['grouping_dict'],
                    'name': tax.name,
                    'tax_base_amount': currency.round(tax_dict['tax_base_amount']),
                    'amount': currency.round(tax_dict['amount']),
                    'tax_exigible': tax_dict['tax_exigible'],
                }
                res['tax_line_to_add'].append(new_vals)
                res['amount_tax'] += new_vals['amount']
                encountered_currency_ids.add(currency.id)

        for existing_tax_line in existing_tax_line_map.values():
            res['tax_line_to_delete'] |= existing_tax_line

        res['amount_total'] = res['amount_tax'] + res['amount_untaxed']

        # In case of multiple involved currencies, the totals are not computed to avoid
        # a lot of currency conversion when not needed most of the time.
        if len(encountered_currency_ids) != 1:
            for key in ('amount_untaxed', 'amount_tax', 'amount_total'):
                res.pop(key)

        return res
