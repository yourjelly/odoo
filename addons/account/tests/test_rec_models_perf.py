# -*- coding: utf-8 -*-

# TODO OCO just for testing perf

from odoo.addons.account.tests.common import AccountTestCommon
from odoo.tests.common import SavepointCase
from odoo.cli.populate import Populate
from odoo.exceptions import UserError
from unittest import skip
from datetime import datetime

import logging

_logger = logging.getLogger()


#@skip
#class TestRecModelsPerf(AccountTestCommon): #To generate data only (useful ?? Everything is regenerated)
class TestRecModelsPerf(SavepointCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        #TODO OCO call populate

        #TODO OCO tailles?
        #Populate.populate(cls.env, 'small', ['account.bank.statement.line', 'account.move']) #TODO OCO uncomment for re-generation

        cls.env.cr.execute("select max(id) from res_company;")
        populated_company_id = cls.env.cr.fetchone()[0]
        cls.company = cls.env['res.company'].browse(populated_company_id)


    @classmethod
    def create_rec_model(cls, specified_vals):
        default_vals =  {
            'name': 'Testing rule',
            'rule_type': 'invoice_matching',
            'auto_reconcile': False,
            'match_nature': 'both',
            'match_same_currency': True,
            'match_total_amount': True,
            'match_total_amount_param': 100,
            'company_id': cls.company.id,
        }

        default_vals.update(specified_vals)
        return cls.env['account.reconcile.model'].sudo().create(default_vals)

    def test_different_model_orders(self):
        # Create rules
        _logger.info("Creating rules...")
        rules_no_partners = [
            (percent, self.create_rec_model({
                'name': label + " (no partners) - " + str(percent) + "% of st lines",
                'match_label': 'contains',
                'match_label_param': label,
            }))
            for percent, label in [(5, 'titi'), (10, 'toto'), (15, 'dudu')]
        ]

        rules_restrict_partners = [
            (percent, self.create_rec_model({
                'name': label + " (no partners) - " + str(percent) + "% of st lines",
                'match_label': 'contains',
                'match_label_param': label,
                'match_partner': True,
            }))
            for percent, label in [(5, 'Zorro'), (15, 'coucou')]
        ]

        # Prepare data to match rules
        st_line_id_lower_bound = 0
        last_changed_invoice_id = 0
        for percent, rule in rules_no_partners:
            _logger.info("Generating data for rule %s" % rule.id)
            last_changed_invoice_id = self._prepare_rule_data(rule, percent, st_line_id_lower_bound, last_changed_invoice_id)
            st_line_id_lower_bound += percent

        for percent, rule in rules_restrict_partners:
            _logger.info("Generating data for rule %s" % rule.id)
            last_changed_invoice_id = self._prepare_rule_data(rule, percent, st_line_id_lower_bound, last_changed_invoice_id, True)
            st_line_id_lower_bound += percent

        self.env['account.bank.statement'].search([('company_id', '=', self.company.id), ('state', '=', 'open')]).button_post()
        # Test
        #TODO OCO bon, du coup, il faudra tout bouger dans account_accountant
        self.env.cr.execute("""
            select array_agg(id)
            from account_bank_statement_line
            where not is_reconciled;
        """)
        statement_line_ids = self.env.cr.fetchone()[0]

        # Test models in various orders
        """'increasing_percent': lambda x: x[0],
            'decreasing_percent': lambda x: -x[0],
            'no_partner_first': lambda x: (x[1]['match_partner']and -1 or 1) * x[0],
            'no_partner_last': lambda x: (x[1]['match_partner']and 1 or -1) * x[0],"""
        sequence_orders = {
            'natural': lambda x: x[1].sequence,
        }

        rslt = {}
        all_rules = rules_no_partners + rules_restrict_partners
        for order, sorting_fun in sequence_orders.items():
            # Reassign rule sequences
            all_rules.sort(key=sorting_fun)
            for index, (percent, rule) in enumerate(all_rules):
                rule.write({'sequence': index})

            # Measure performance
            time_start = datetime.now()
            self.env['account.reconciliation.widget'].get_bank_statement_line_data(statement_line_ids, None)
            time_stop = datetime.now()
            delta = time_stop - time_start
            rslt[order] = delta.seconds * 1000000 + delta.microseconds

        _logger.info("RESULT " + str(rslt))


    def _prepare_rule_data(self, rule, percent, st_line_id_lower_bound, last_changed_invoice_id, force_partner=False):
        self.env.cr.execute("""
            select array_agg(id)
            from account_bank_statement_line
            where (id %% 100) between %(lower_percent_bound)s and %(upper_percent_bound)s
                  and not is_reconciled;
        """, {
            'lower_percent_bound': st_line_id_lower_bound,
            'upper_percent_bound': (st_line_id_lower_bound + percent - 1),
        })
        st_line_ids_to_change = self.env.cr.fetchone()[0]

        for st_line_id in st_line_ids_to_change:
            reference_to_set = rule.match_label_param + str(st_line_id)
            invoice = self.env['account.move'].search([('move_type', 'in', ('in_invoice', 'out_invoice', 'in_refund', 'out_refund')),
                                             ('state', '=', 'posted'),
                                             ('payment_state', '=', 'not_paid'),
                                             ('id', '>', last_changed_invoice_id)], limit=1, order='id ASC')

            if not invoice:
                raise UserError("Should always get an invoice here! Maybe you had bad luck with populate? :o")

            #TODO OCO je ne fais pas ça en sql, mais ce sera pê nécessaire si trop lent
            invoice.button_draft()
            invoice.write({'payment_reference': reference_to_set})
            invoice.post()

            st_line = self.env['account.bank.statement.line'].browse(st_line_id)
            st_line_vals = {'payment_ref': reference_to_set, 'partner_id': None}

            if force_partner:
                st_line_vals['partner_id'] = invoice.partner_id.id
                rule.write({'match_partner_ids': [(4, invoice.partner_id.id, 0)]})

            st_line.write(st_line_vals)

            last_changed_invoice_id = invoice.id

        return last_changed_invoice_id

    def test_no_model_matching_anything(self):
        pass #TODO OCO

    #TODO OCO ajouter un test qui compte sur une partner_map fournie ? => A voir ; en fait c'est déjà un peu mesuré par les statement lines avec un partenaire set