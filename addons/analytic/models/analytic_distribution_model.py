# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError
import json

class AccountAnalyticDistributionModel(models.Model):
    _name = 'account.analytic.distribution.model'
    _inherit = 'analytic.mixin'
    _description = 'Analytic Distribution Model'
    _rec_name = 'create_date'
    _order = 'id desc'

    partner_id = fields.Many2one(
        'res.partner',
        string='Partner',
        ondelete='cascade',
        help="Select a partner for which the analytic distribution will be used (e.g. create new customer invoice or Sales order if we select this partner, it will automatically take this as an analytic account)",
    )
    partner_category_id = fields.Many2one(
        'res.partner.category',
        string='Partner Category',
        ondelete='cascade',
        help="Select a partner category for which the analytic distribution will be used (e.g. create new customer invoice or Sales order if we select this partner, it will automatically take this as an analytic account)",
    )
    company_id = fields.Many2one(
        'res.company',
        string='Company',
        default=lambda self: self.env.company,
        ondelete='cascade',
        help="Select a company for which the analytic distribution will be used (e.g. create new customer invoice or Sales order if we select this company, it will automatically take this as an analytic account)",
    )

    @api.constrains('company_id', 'analytic_distribution_stored_char')
    def _check_company_accounts(self):

        self.flush_recordset(['company_id', 'analytic_distribution_stored_char'])

        query = """
            SELECT model.id
              FROM account_analytic_distribution_model model
              JOIN account_analytic_account account
                ON CAST(model.analytic_distribution_stored_char AS jsonb) ? CAST(account.id AS VARCHAR)
             WHERE account.company_id IS NOT NULL 
               AND (model.company_id IS NULL 
                OR model.company_id != account.company_id)
          GROUP BY model.id
        """
        self._cr.execute(query)
        if self._cr.fetchone():
            raise UserError(_("You defined a model with accounts belonging to a company than the model's company (or the model has no company)."))

    @api.model
    def _get_distribution(self, vals):
        """ Returns the distribution model that has the most fields that corresponds to the vals given
            This method should be called to prefill analytic distribution field on several models """
        domain = []
        for fname, value in vals.items():
            domain += self._create_domain(fname, value) or []
        best_score = 0
        res = {}
        for rec in self.search(domain):
            score = 0
            for key, value in vals.items():
                if value and rec[key]:
                    if rec._check_score(key, value) == 1:
                        score += 1
                    else:
                        score = -1
                        break
            if score > best_score:
                res = rec.analytic_distribution
                best_score = score
        return res

    def _check_score(self, key, value):
        self.ensure_one()
        if key == 'partner_category_id':
            if self[key].id in value:
                return 1
        if value == self[key].id:
            return 1
        else:
            return -1

    def _create_domain(self, fname, value):
        if not value:
            return False
        if fname == 'partner_category_id':
            value += [False]
            return [(fname, 'in', value)]
        else:
            return [(fname, 'in', [value, False])]

    @api.model
    def _get_distributionjson(self, vals):
        """ Returns the distribution model as a json for the compute_analytic_distribution_stored_char functions"""
        distribution = self._get_distribution(vals)
        return json.dumps(distribution) if distribution else None
