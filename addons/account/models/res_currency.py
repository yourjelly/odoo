# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields, _
from odoo.exceptions import UserError
from odoo.tools import date_utils, SQL
from odoo.addons import product


class ResCurrency(product.ResCurrency):

    def _get_fiscal_country_codes(self):
        return ','.join(self.env.companies.mapped('account_fiscal_country_id.code'))

    display_rounding_warning = fields.Boolean(string="Display Rounding Warning", compute='_compute_display_rounding_warning',
        help="The warning informs a rounding factor change might be dangerous on res.currency's form view.")
    fiscal_country_codes = fields.Char(store=False, default=_get_fiscal_country_codes)

    @api.depends('rounding')
    def _compute_display_rounding_warning(self):
        for record in self:
            record.display_rounding_warning = record.id \
                                              and record._origin.rounding != record.rounding \
                                              and record._origin._has_accounting_entries()

    def write(self, vals):
        if 'rounding' in vals:
            rounding_val = vals['rounding']
            for record in self:
                if (rounding_val > record.rounding or rounding_val == 0) and record._has_accounting_entries():
                    raise UserError(_("You cannot reduce the number of decimal places of a currency which has already been used to make accounting entries."))

        return super(ResCurrency, self).write(vals)

    def _has_accounting_entries(self):
        """ Returns True iff this currency has been used to generate (hence, round)
        some move lines (either as their foreign currency, or as the main currency).
        """
        self.ensure_one()
        return bool(self.env['account.move.line'].sudo().search_count(['|', ('currency_id', '=', self.id), ('company_currency_id', '=', self.id)]))

    def _get_simple_currency_table(self, companies) -> SQL:
        """ Helper creating the currency table and returning its definition for basic cases of Odoo reports needing to convert amounts using only the
        current rates, in a single period.
        """
        if self._check_currency_table_monocurrency(companies):
            return self._get_monocurrency_currency_table_sql(companies)

        self._create_currency_table(companies, [('period', None, fields.Date.today())])
        return SQL('account_currency_table')

    def _check_currency_table_monocurrency(self, companies):
        """ Returns whether displaying the data of the provided companies can be done with a monocurrency currency table.
        If it can, calling _get_monocurrency_currency_table_sql is enough to join the currency table (which actually consists of a bunch of VALUES
        directly injected in the join).
        Else, a full-flegdge temporary table will be needed, that will have to be generated by a call to _create_currency_table.
        """
        return len(companies.currency_id) == 1

    def _get_monocurrency_currency_table_sql(self, companies, use_cta_rates=False):
        """ Returns a simplified currency table, faster to generate, for cases were all the data to convert are expressed in the same currency,
        to be use in a JOIN. It actually just consists of a few VALUES ; no temporary table is created in this case.

        All the rates in this currency table are equal to 1 (since everything is in the same currency). This is useful so that the queries can
        be written exactly in the same way, joining the currency table returned by some function, for both mono and multi currency cases.
        """
        unit_rates = [
            SQL("(%(company_id)s, CAST(NULL AS VARCHAR), CAST(NULL AS DATE), CAST(NULL AS DATE), %(rate_type)s, 1)", company_id=company.id, rate_type=rate_type)
            for company in companies
            for rate_type in (('historical', 'current', 'average') if use_cta_rates else ('current',))
        ]
        return SQL('(VALUES %s) AS account_currency_table(company_id, period_key, date_from, date_next, rate_type, rate)', SQL(',').join(unit_rates))

    def _create_currency_table(self, companies, date_periods, use_cta_rates=False):
        """ Creates a temporary table containing the currency rates to be used in order to aggregate amounts belonging to companies
        with different main currencies in a reporting query.
        These rates are computed from the res.currrency.rate objects defined for self.env.company.

        The currency table consists of the following columns:
            - company_id: The id of the company whose amounts can be converted with this rate.
            - period_key: The key corresponding to the period this rate is valid for. (see params list)
            - date_from: Only set for rate_type 'historical'. The starting date for this rate.
            - date_next: Only set for rate_type 'historical'. The date of the next rate. So, the rate applies until one day before date_next.
            - rate_type: 'historical', 'current' or 'average'
                            - 'historical' means the rate is to be used to convert operations at the date they were made; they each
                               directly correspond to the res.currency.rate objects of the active company
                            - 'current' means this rate is the most recent rate within the period. This rate is unique per (company_id, period_key).
                            - 'average' means this rate is the average rate for the period. This rate is unique per (company_id, period_key).
            - rate: The rate to apply, as a decimal factor to apply directly to the value to convert, provided it is expressed in the
                    main currency of the company referred to by company_id.


        :param companies: The res.company objects to generate rates for.
        :param date_periods: List of tuples in the form (period_key, date_from, date_to), containing each of the periods to generate rates for, where:
                             - period_key is a unique string identifier used to differentiate the periods
                             - date_from is the date the period starts at ; it can be None if the period want to consider everything from the beginning
                             - date_to is the date the periods ends at
        :param use_cta_rates: Boolean parameter, enabling the computation of CTA rates. If True, 'current', 'average' and 'historical' rates will be
                        computed for all companies, for all periods. Else, only 'current' will be computed.
        """
        main_company = self.env.company
        domestic_currency_companies = companies.filtered(lambda x: x.currency_id == main_company.currency_id)
        other_companies = companies - domestic_currency_companies

        table_builders = [self._get_table_builder_domestic_currency(domestic_currency_companies, use_cta_rates)]

        last_date_to = None
        for period_key, date_from, date_to in date_periods:
            main_company_unit_factor = main_company.currency_id._get_rates(main_company, date_to)[main_company.currency_id.id]

            table_builders.append(self._get_table_builder_current(period_key, main_company, other_companies, date_to, main_company_unit_factor))

            if use_cta_rates:
                table_builders += [
                    self._get_table_builder_historical(main_company, other_companies, date_to, main_company_unit_factor, last_date_to),
                    self._get_table_builder_average(period_key, main_company, other_companies, date_from, date_to, main_company_unit_factor),
                ]

            last_date_to = date_to

        self._cr.execute(SQL(
            """
                -- Tests may call this function multiple times within the same transaction; we then need to delete an regenerate the currency table
                DROP TABLE IF EXISTS account_currency_table;

                -- Create a temporary table
                CREATE TEMPORARY TABLE
                account_currency_table (company_id, period_key, date_from, date_next, rate_type, rate)
                ON COMMIT DROP
                AS (%(currency_table_build_query)s);

                -- Create a supporting index to avoid seq.scans
                CREATE INDEX account_currency_table_index ON account_currency_table (company_id, rate_type, date_from, date_next);
                -- Update statistics for correct planning
                ANALYZE account_currency_table;
            """,
            currency_table_build_query=SQL(" UNION ALL ").join(SQL('(%s)', builder) for builder in table_builders),
        ))

    def _get_table_builder_domestic_currency(self, companies, use_cta_rates) -> SQL:
        """ Returns a query building one rate of each appropriate type equal to 1 for each of the provided companies. Those companies should be
        the ones sharing the same currency as self.env.company.
        """
        rate_values = []
        for company in companies:
            rate_values.append(SQL("(%s, CAST(NULL AS VARCHAR), CAST(NULL AS DATE), CAST(NULL AS DATE), 'current', 1)", company.id))

            if use_cta_rates:
                rate_values += [
                    SQL("(%s, CAST(NULL AS VARCHAR), CAST(NULL AS DATE), CAST(NULL AS DATE), 'average', 1)", company.id),
                    SQL("(%s, CAST(NULL AS VARCHAR), CAST(NULL AS DATE), CAST(NULL AS DATE), 'historical', 1)", company.id),
                ]

        return SQL(
            """
                SELECT *
                FROM ( VALUES
                    %(rate_values)s
                ) values
            """,
            rate_values=SQL(", ").join(rate_values)
        )

    def _get_table_builder_current(self, period_key, main_company, other_companies, date_to, main_company_unit_factor) -> SQL:
        return SQL(
            """
                SELECT DISTINCT ON (other_company.id)
                    other_company.id,
                    %(period_key)s,
                    CAST(NULL AS DATE),
                    CAST(NULL AS DATE),
                    'current',
                    CASE WHEN rate.id IS NOT NULL THEN %(main_company_unit_factor)s / rate.rate ELSE 1 END
                FROM res_company other_company
                LEFT JOIN res_currency_rate rate
                    ON rate.currency_id = other_company.currency_id
                    AND rate.name <= %(date_to)s
                    AND rate.company_id = %(main_company_id)s
                WHERE
                    other_company.id IN %(other_company_ids)s
                ORDER BY other_company.id, rate.name DESC
            """,
            period_key=period_key,
            main_company_id=main_company.root_id.id,
            other_company_ids=tuple(other_companies.ids),
            date_to=date_to,
            main_company_unit_factor=main_company_unit_factor,
        )

    def _get_table_builder_historical(self, main_company, other_companies, date_to, main_company_unit_factor, date_exclude) -> SQL:
        return SQL(
            """
                SELECT
                    other_company.id,
                    CAST(NULL AS VARCHAR),
                    rate.name,
                    LAG(rate.name, 1) OVER (PARTITION BY other_company.id, rate.currency_id ORDER BY rate.name DESC),
                    'historical',
                    %(main_company_unit_factor)s / rate.rate
                FROM res_company other_company
                JOIN res_currency_rate rate
                    ON rate.currency_id = other_company.currency_id
                WHERE
                    other_company.id IN %(other_company_ids)s
                    AND rate.company_id = %(main_company_id)s
                    AND rate.name <= %(date_to)s
                    %(exclusion_condition)s
            """,
            main_company_id=main_company.root_id.id,
            other_company_ids=tuple(other_companies.ids),
            main_company_unit_factor=main_company_unit_factor,
            date_to=date_to,
            exclusion_condition=SQL("AND rate.name > %(date_exclude)s", date_exclude=date_exclude) if date_exclude else SQL(),
        )

    def _get_table_builder_average(self, period_key, main_company, other_companies, date_from, date_to, main_company_unit_factor) -> SQL:
        if not date_from:
            # When there is no start date, we want to compute the average rate on the current year only
            date_from = date_utils.start_of(fields.Date.from_string(date_to), 'year')

        return SQL(
            """
                SELECT
                    rate_with_days.other_company_id,
                    %(period_key)s,
                    CAST(NULL AS DATE),
                    CAST(NULL AS DATE),
                    'average',
                    SUM(%(main_company_unit_factor)s / rate_with_days.rate * rate_with_days.number_of_days) / SUM(rate_with_days.number_of_days)
                FROM (
                    SELECT
                        other_company.id as other_company_id,
                        rate.rate AS rate,
                        EXTRACT (
                            'Day' FROM COALESCE(
                                LEAD(rate.name, 1) OVER (PARTITION BY other_company.id, rate.currency_id ORDER BY rate.name ASC)::TIMESTAMP,
                                %(date_to)s::TIMESTAMP + INTERVAL '1' DAY
                            ) - rate.name::TIMESTAMP
                        ) AS number_of_days
                    FROM res_company other_company
                    JOIN res_currency_rate rate
                        ON rate.currency_id = other_company.currency_id
                    WHERE
                    rate.name <= %(date_to)s
                    AND rate.name >= %(date_from)s
                    AND other_company.id IN %(other_company_ids)s
                    AND rate.company_id = %(main_company_id)s

                    UNION ALL

                    (
                        SELECT DISTINCT ON (other_company.id)
                            other_company.id as other_company_id,
                            out_period_rate.rate AS rate,
                            EXTRACT('Day' FROM COALESCE(in_period_rate.name::TIMESTAMP, %(date_to)s::TIMESTAMP + INTERVAL '1' DAY) - %(date_from)s::TIMESTAMP) AS number_of_days

                        FROM res_company other_company

                        LEFT JOIN res_currency_rate in_period_rate
                            ON in_period_rate.currency_id = other_company.currency_id
                            AND in_period_rate.name <= %(date_to)s
                            AND in_period_rate.name >= %(date_from)s
                            AND in_period_rate.company_id = %(main_company_id)s

                        LEFT JOIN res_currency_rate out_period_rate
                            ON out_period_rate.currency_id = other_company.currency_id
                            AND out_period_rate.company_id = %(main_company_id)s
                            AND out_period_rate.name < %(date_from)s

                        WHERE
                        other_company.id IN %(other_company_ids)s
                        ORDER BY other_company.id, in_period_rate.name ASC, out_period_rate.name DESC
                    )
                ) rate_with_days
                GROUP BY rate_with_days.other_company_id
            """,
            period_key=period_key,
            main_company_id=main_company.root_id.id,
            other_company_ids=tuple(other_companies.ids),
            date_from=date_from,
            date_to=date_to,
            main_company_unit_factor=main_company_unit_factor,
        )
