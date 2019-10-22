# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError

from collections import defaultdict
from pprint import pprint
from timeit import default_timer as timer
import random
import psycopg2
import datetime

REFERENCE_DATE = datetime.date(1970, 1, 1)


def compute_recurence(dates, max_bin_size=5):
    dates_diff = [dates[k + 1] - dates[k] for k in range(len(dates) - 1)]
    recurence = [defaultdict(lambda: defaultdict(lambda: 0)) for i in range(max_bin_size + 1)]
    for i in range(len(dates_diff)):
        for sequence_len in range(0, max_bin_size + 1):
            if i + sequence_len < len(dates_diff):
                sequence = tuple(dates_diff[i:i + sequence_len])
                recurence[sequence_len][sequence][dates_diff[i + sequence_len]] += 1
    return recurence


def prune(recurence, min_occurence=5):
    tree = {}
    for rec in recurence:
        for k, v in rec.items():
            sorted = list(v.items())
            summed = sum(s[1] for s in sorted)
            sorted.sort(key=lambda i: i[1])
            max_item = sorted[-1]
            if not sorted or max_item[1] < min_occurence or max_item[1] < (summed / 2):
                continue
            tree[k] = max_item[0]
    return tree


def find(dates, tree, min_bin_size=2):
    max_bin_size = max((len(i) for i in tree.keys()), default=0)
    found = set()
    dates_set = set(dates)
    dates_diff = [dates[k + 1] - dates[k] for k in range(len(dates) - 1)]
    for i in range(len(dates_diff) + 1):
        for sequence_len in range(max_bin_size, min_bin_size, -1):
            if i - sequence_len >= 0:
                seq = dates_diff[i - sequence_len:i]
                res = tree.get(tuple(seq))
                if res:
                    add = True
                    range_res = int(res / 4)
                    for days in range(-range_res, range_res + 1):
                        if res + dates[i] + days in dates_set:
                            add = False
                            break
                    if add:
                        found.add(dates[i] + res)
                        break
    return found


class AIWizard(models.TransientModel):
    _name = 'account.ai.wizard'
    _description = 'Deduce things'

    company_id = fields.Many2one('res.company', default=lambda self: self.env.company)
    line_ids = fields.One2many('account.ai.wizard.line', 'wizard_id', compute="compute_things")

    def _get_dates(self):
        self.env.cr.execute("""
            WITH amount_range(amount_range) AS ( VALUES
                (int4range(NULL, -51200)),
                (int4range(-102400, -12800)),
                (int4range(-25600, -3200)),
                (int4range(-6400, -800)),
                (int4range(-1600, -200)),
                (int4range(-400, -50)),
                (int4range(-100, 0)),
                (int4range(0, 100)),
                (int4range(50, 400)),
                (int4range(200, 1600)),
                (int4range(800, 6400)),
                (int4range(3200, 25600)),
                (int4range(12800, 102400)),
                (int4range(51200, NULL))
            ),
            amount_range_sign(amount_range) AS ( VALUES
                (int4range(NULL, 0)),
                (int4range(0, NULL))
            ),
            no_amount_range(amount_range) AS ( VALUES
                (int4range(NULL, NULL))
            )
            SELECT account_id, partner_id, amount_range, array_agg(DISTINCT date ORDER BY date ASC)
            FROM account_move_line
            LEFT JOIN amount_range ON balance::int <@ amount_range
            GROUP BY account_id, partner_id, amount_range
        """)
        dates_grouped = self.env.cr.fetchall()
        return {(acc, par, (ran.lower, ran.upper)): [(dat - REFERENCE_DATE).days for dat in dats] for acc, par, ran, dats in dates_grouped}

    @api.depends('company_id')
    def compute_things(self):
        dates_dict = self._get_dates()
        propositions = {}
        for key, dates in dates_dict.items():
            recurence = compute_recurence(dates, 25)
            tree = prune(recurence, 2)
            found = find(dates, tree)

            if found:
                propositions[key] = {REFERENCE_DATE + datetime.timedelta(f) for f in found}
        self.line_ids = self.env['account.ai.wizard.line']
        for key, value in propositions.items():
            account_id, partner_id, range = key
            for date in value:
                self.line_ids += self.env['account.ai.wizard.line'].create({
                    'account_id': account_id,
                    'partner_id': partner_id,
                    'range_up': range[1],
                    'range_down': range[0],
                    'date': date,
                })


class AIWizardProposition(models.TransientModel):
    _name = 'account.ai.wizard.line'
    _description = 'Deduced things'

    wizard_id = fields.Many2one('account.ai.wizard')
    account_id = fields.Many2one('account.account')
    partner_id = fields.Many2one('res.partner')
    range_up = fields.Integer()
    range_down = fields.Integer()
    date = fields.Date()

    def action_open(self):
        self.ensure_one()
        domain = [('account_id', '=', self.account_id.id), ('partner_id', '=', self.partner_id.id)]
        if self.range_up:
            domain += [('balance', '<=', self.range_up)]
        if self.range_down:
            domain += [('balance', '>=', self.range_down)]
        return {
            'name': "{account}, {partner} between {down} and {up} for {date}".format(
                account=self.account_id.display_name,
                partner=self.partner_id.display_name,
                down=self.range_down,
                up=self.range_up,
                date=self.date,
            ),
            'type': 'ir.actions.act_window',
            'res_model': 'account.move.line',
            'view_mode': 'tree,form',
            'domain': domain,
        }

    def action_create(self):
        self.ensure_one()
        raise UserError("Not implemented yet, dont be greedy")
