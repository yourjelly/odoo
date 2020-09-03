# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class AccountBusinessLineMixin(models.AbstractModel):
    _name = 'account.business.line.mixin'
    _description = "Business Lines Helpers"

    # -------------------------------------------------------------------------
    # GETTERS
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

    def _is_sale_document(self):
        # TO BE OVERRIDDEN
        return False

    def _is_purchase_document(self):
        # TO BE OVERRIDDEN
        return False

    def _is_refund_document(self):
        # TO BE OVERRIDDEN
        return False

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    def _get_default_product_name(self):
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
        if self._is_sale_document():
            if product.description_sale:
                values.append(product.description_sale)
        elif self._is_purchase_document():
            if product.description_purchase:
                values.append(product.description_purchase)
        return '\n'.join(values)

    def _get_default_product_uom(self):
        company = self._get_company()
        if company:
            self = self.with_company(company)

        product = self._get_product()
        return product.uom_id

    def _get_default_product_account(self):
        company = self._get_company()
        if company:
            self = self.with_company(company)

        product = self._get_product()
        journal = self._get_journal()
        fiscal_position = self._get_fiscal_position()

        if product:
            accounts = product.product_tmpl_id.get_product_accounts(fiscal_pos=fiscal_position)
            if self._is_sale_document():
                account = accounts['income']
            elif self._is_purchase_document():
                account = accounts['expense']
            else:
                account = self.env['account.account']
        else:
            account = self.env['account.account']

        if not account and journal:
            account = journal.default_account_id

        return account

    def _get_default_product_taxes(self):
        company = self._get_company()
        if company:
            self = self.with_company(company)

        product = self._get_product()
        company = self._get_company()
        fiscal_position = self._get_fiscal_position()
        partner = self._get_partner()
        account = self._get_account()

        if self._is_sale_document():
            taxes = product.taxes_id
        elif self._is_purchase_document():
            taxes = product.supplier_taxes_id
        else:
            taxes = self.env['account.tax']

        if company:
            taxes = taxes.filtered(lambda tax: tax.company_id == company)

        if not taxes:
            taxes = account.tax_ids

        if not taxes:
            if self._is_sale_document():
                taxes = company.account_sale_tax_id
            elif self._is_purchase_document():
                taxes = company.account_purchase_tax_id

        if taxes and fiscal_position:
            taxes = fiscal_position.map_tax(taxes, partner=partner)

        return taxes

    def _get_default_product_price_unit(self):
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

        if self._is_sale_document():
            price_unit = product.lst_price
            product_taxes = product.taxes_id
        elif self._is_purchase_document():
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
        tax = repartition_line.invoice_tax_id or repartition_line.refund_tax_id
        if tax.tax_exigibility == 'on_payment':
            account = tax.cash_basis_transition_account_id
        else:
            account = repartition_line.account_id
        return account

    # -------------------------------------------------------------------------
    # TAXES
    # -------------------------------------------------------------------------

    def _get_tax_round_globally_grouping_key_from_base_line(self):
        self.ensure_one()
        return {
            'account_id': self._get_account().id,
            'currency_id': self._get_currency().id,
            'analytic_tag_ids': [(6, 0, self._get_analytic_tags().ids)],
            'analytic_account_id': self._get_analytic_account().id,
            'tax_ids': [(6, 0, self._get_taxes().ids)],
        }

    def _get_tax_grouping_key_from_base_lines(self, tax_vals):
        tax_repartition_line = self.env['account.tax.repartition.line'].browse(tax_vals['tax_repartition_line_id'])
        account = self._get_default_tax_account(tax_repartition_line) or self[0].account_id
        return {
            'tax_repartition_line_id': tax_vals['tax_repartition_line_id'],
            'account_id': account.id,
            'currency_id': self[0]._get_currency().id,
            'analytic_tag_ids': [(6, 0, self[0]._get_analytic_tags().ids if tax_vals['analytic'] else [])],
            'analytic_account_id': self[0]._get_analytic_account().id if tax_vals['analytic'] else False,
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
            'currency_id': self._get_currency().id,
            'analytic_tag_ids': [(6, 0, self._get_analytic_tags().ids if tax.analytic else [])],
            'analytic_account_id': self._get_analytic_account().id if tax.analytic else False,
            'tax_ids': [(6, 0, self._get_taxes().ids)],
            'tax_tag_ids': [(6, 0, self._get_tags().ids)],
        }

    def _compute_diff_taxes(self):
        def _serialize_python_dictionary(dict):
            return '-'.join(str(v) for v in dict.values())

        if not self:
            return {}

        res = {
            'tax_line_to_add': [],
            'tax_line_to_delete': self.env[self[0]._name],
            'tax_line_to_update': [],
            'base_line_to_update': [],
            'amount_untaxed': 0.0,
            'amount_total': 0.0,
        }

        company = self[0]._get_company()
        is_refund = self[0]._is_refund_document()
        tax_calculation_rounding_method = company.tax_calculation_rounding_method or 'round_per_line'

        # 1

        base_lines = self.filtered(lambda line: not line._get_tax_repartition_line())

        base_line_batches = []
        if tax_calculation_rounding_method == 'round_per_line':
            for line in base_lines:
                base_line_batches.append([line, [line._get_price_unit_without_discount()], {
                    'currency': line._get_currency(),
                    'quantity': line._get_quantity(),
                    'product': line._get_product(),
                    'partner': line._get_partner(),
                    'is_refund': is_refund,
                    'handle_price_include': line._is_sale_document() or line._is_purchase_document(),
                }])
        else: # tax_calculation_rounding_method == 'round_globally'
            batches_map = {}
            for line in base_lines:
                map_key = _serialize_python_dictionary(self._get_tax_round_globally_grouping_key_from_base_line())
                batches_map.setdefault(map_key, [self.env[line._name], [line._get_price_unit_without_discount()], {
                    'currency': line._get_currency(),
                    'quantity': 0.0,
                    'product': line._get_product(),
                    'partner': line._get_partner(),
                    'is_refund': is_refund,
                    'handle_price_include': line._is_sale_document() or line._is_purchase_document(),
                }])
                batches_map[map_key][0] |= line
                batches_map[map_key][2]['quantity'] += line._get_quantity()
            for batch in batches_map.values():
                base_line_batches.append(batch)

        # 2

        tax_lines = self.filtered(lambda line: line._get_tax_repartition_line())

        existing_tax_line_map = {}
        for line in tax_lines:
            map_key = _serialize_python_dictionary(self._get_tax_grouping_key_from_tax_line())
            if map_key in existing_tax_line_map:
                res['tax_line_to_delete'] |= line
            else:
                existing_tax_line_map[map_key] = line

        # 3

        tax_line_to_update_vals_map = {}
        for batch_lines, args, kwargs in base_line_batches:
            taxes = batch_lines[0]._get_taxes()._origin
            taxes_res = taxes.with_context(round=True).compute_all(*args, **kwargs)

            res['amount_untaxed'] += taxes_res['total_excluded']
            res['amount_total'] += taxes_res['total_included']

            base_line_to_update_vals = {
                'tax_exigible': True,
                'tax_tag_ids': [(6, 0, taxes_res['base_tags'])],
            }
            for tax_vals in taxes_res['taxes']:
                tax = self.env['account.tax'].browse(tax_vals['id'])
                grouping_dict = batch_lines._get_tax_grouping_key_from_base_lines(tax_vals)
                map_key = _serialize_python_dictionary(grouping_dict)

                if tax.tax_exigibility == 'on_payment':
                    base_line_to_update_vals['tax_exigible'] = False

                tax_line_to_update_vals_map.setdefault(map_key, {
                    'existing_tax_line': existing_tax_line_map.pop(map_key, None),
                    'grouping_dict': grouping_dict,
                    'tax_base_amount': 0.0,
                    'amount': 0.0,
                })
                tax_line_to_update_vals_map[map_key]['tax_base_amount'] += tax_vals['base']
                tax_line_to_update_vals_map[map_key]['amount'] += tax_vals['amount']
            for line in batch_lines:
                res['base_line_to_update'].append((line, base_line_to_update_vals))

        for tax_dict in tax_line_to_update_vals_map.values():
            if tax_dict['existing_tax_line']:
                res['tax_line_to_update'].append((tax_dict['existing_tax_line'], {
                    'tax_base_amount': tax_dict['tax_base_amount'],
                    'amount': tax_dict['amount'],
                }))
            else:
                res['tax_line_to_add'].append({
                    **tax_dict['grouping_dict'],
                    'tax_base_amount': tax_dict['tax_base_amount'],
                    'amount': tax_dict['amount'],
                })

        for existing_tax_line in existing_tax_line_map.values():
            res['tax_line_to_delete'] |= existing_tax_line

        res['amount_tax'] = res['amount_total'] - res['amount_untaxed']

        return res
