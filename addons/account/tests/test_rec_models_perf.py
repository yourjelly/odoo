# -*- coding: utf-8 -*-

# TODO OCO just for testing perf

from odoo.addons.account.tests.common import AccountTestCommon
from odoo.tests.common import SavepointCase
#from odoo.cli.populate import Populate TODO OCO non, en fait, pas ici
from odoo.exceptions import UserError
from unittest import skip
from datetime import datetime

import logging

_logger = logging.getLogger()


@skip#TODO OCO: no need to run it on runbot :p
class TestRecModelsPerf(SavepointCase):

    """
    TODO OCO
    pour régler le petit souci de wan avec les partner sur les amls:

    update account_move_line aml
    set partner_id = move.partner_id
    from account_move move, account_account acc
    where move.move_type in ('in_invoice', 'out_invoice', 'in_refund', 'out_refund')
    and aml.move_id = move.id
    and acc.id = aml.account_id
    and acc.internal_type not in ('receivable', 'payable');

    update account_move_line aml
    set partner_id = coalesce(move.commercial_partner_id, move.partner_id)
    from account_move move, account_account acc
    where move.move_type in ('in_invoice', 'out_invoice', 'in_refund', 'out_refund')
    and aml.move_id = move.id
    and acc.id = aml.account_id
    and acc.internal_type in ('receivable', 'payable');
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        #TODO OCO à faire tourner pour préparer la db, dans un shell ou quoi (pas ici, car commit tout; y compris les opérations des tests)
        #Populate.populate(cls.env, 'small', ['account.bank.statement.line', 'account.move'])

        cls.env['account.reconcile.model'].search([]).unlink()

        cls.env.cr.execute("select max(id) from res_company;")
        populated_company_id = cls.env.cr.fetchone()[0]
        cls.company = cls.env['res.company'].browse(populated_company_id)
        #TODO OCO faire varier le nombre de st lines ?? C'est p-ê ça qui charge ton modèle ; 100 d'un coup ? (c'est pas tant que ça :/)


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
            for percent, label in [(5, 'titi'), (10, 'toto'), (15, 'dudu'), (30, 'tournicoti')]
        ]

        rules_restrict_partners = [
            (percent, self.create_rec_model({
                'name': label + " (restricted partners) - " + str(percent) + "% of st lines",
                'match_label': 'contains',
                'match_label_param': label,
                'match_partner': True,
            }))
            for percent, label in [(5, 'Zorro'), (15, 'coucou')]
        ]

        # Prepare data to match rules
        st_line_id_lower_bound = 0
        selected_invoice_ids = []
        for percent, rule in rules_no_partners:
            _logger.info("Generating data for rule %s" % rule.id)
            self._prepare_rule_data(rule, percent, st_line_id_lower_bound, selected_invoice_ids)
            st_line_id_lower_bound += percent

        for percent, rule in rules_restrict_partners:
            _logger.info("Generating data for rule %s" % rule.id)
            self._prepare_rule_data(rule, percent, st_line_id_lower_bound, selected_invoice_ids, True)
            st_line_id_lower_bound += percent

        statements_to_post = self.env['account.bank.statement'].search([('company_id', '=', self.company.id), ('state', '=', 'open')])
        statements_to_post.button_post()
        # Test
        #TODO OCO bon, du coup, il faudra tout bouger dans account_accountant
        self.env.cr.execute("""
            select array_agg(id)
            from account_bank_statement_line
            where not is_reconciled;
        """)
        statement_line_ids = self.env.cr.fetchone()[0]

        # Test models in various orders
        sequence_orders = {
            'increasing_percent': lambda x: x[0],
            'decreasing_percent': lambda x: -x[0],
            'restrict_partner_first': lambda x: (x[1]['match_partner']and -1 or 1) * x[0],
            'restrict_partner_last': lambda x: (x[1]['match_partner']and 1 or -1) * x[0],
        }

        rslt = {}
        all_rules = rules_no_partners + rules_restrict_partners
        for order, sorting_fun in sequence_orders.items():
            _logger.info("Testing order %s" % order)
            print("Testing order %s" % order)
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


    def _prepare_rule_data(self, rule, percent, st_line_id_lower_bound, selected_invoice_ids, force_partner=False):
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
            st_line = self.env['account.bank.statement.line'].browse(st_line_id)

            reference_to_set = rule.match_label_param + str(st_line_id)
            allowed_types = st_line.amount > 0 and ('out_invoice', 'in_refund') or ('in_invoice', 'out_refund')
            invoice = self.env['account.move'].search([('move_type', 'in', allowed_types),
                                             ('state', '=', 'posted'),
                                             ('payment_state', '=', 'not_paid'),
                                             ('currency_id', '=', st_line.currency_id.id),
                                             ('id', 'not in', selected_invoice_ids)], limit=1, order='id ASC')

            if not invoice:
                raise UserError("Should always get an invoice here! Maybe you had bad luck with populate? :o")

            selected_invoice_ids.append(invoice.id)
            invoice.button_draft()
            invoice.write({'payment_reference': reference_to_set})
            invoice._onchange_payment_reference()
            invoice.post()

            st_line_vals = {'payment_ref': reference_to_set, 'partner_id': None}

            if force_partner:
                st_line_vals['partner_id'] = invoice.partner_id.id
                rule.write({'match_partner_ids': [(4, invoice.partner_id.id, 0)]})

            st_line.write(st_line_vals)

    def test_no_model_matching_anything(self):
        pass #TODO OCO

    #TODO OCO ajouter un test qui compte sur une partner_map fournie ? => A voir ; en fait c'est déjà un peu mesuré par les statement lines avec un partenaire set