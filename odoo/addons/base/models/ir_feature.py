# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api
from odoo.http import request
from odoo.tools.cache import ormcache
from odoo.tools.misc import frozendict


class IrFeature(models.Model):
    _name = 'ir.feature'
    _description = "Features: feature activate by company"
    _order = 'technical_name'
    _rec_name = 'description'

    technical_name = fields.Char("Technical Name", required=True, index=True)
    description = fields.Char("Description", required=True, translate=True)
    by_company = fields.Boolean("By Company", default=True)
    company_ids = fields.Many2many('res.company', string="Activate On")

    _sql_constraints = [
        ('uniq_technical_name', 'unique(technical_name)', 'A feature technical name should be unique'),
    ]

    @api.model
    @ormcache()
    def _get_all_features_by_company(self):
        """ Return feature activated by company in companies """
        table_relation = self._fields['company_ids'].relation
        col_feature_id = self._fields['company_ids'].column1
        col_company_id = self._fields['company_ids'].column2
        self.env.cr.execute(f"""
            SELECT rc.company_id,
                   array_agg(fea.technical_name) AS technical_names
              FROM res_company AS rc
                   LEFT JOIN {table_relation} AS rel
                             ON rel.{col_company_id} = rc.id
                   LEFT JOIN ir_feature AS fea
                             ON fea.id = rel.{col_feature_id}
             WHERE fea.technical_name IS NOT NULL
          GROUP BY rc.company_id
          ORDER BY rc.company_id
        """)
        return frozendict((company_id, frozenset(technical_names)) for company_id, technical_names in self.env.cr.fetchall())

    @api.model
    def _is_debug(self):
        return True if request and request.session.debug else False

    @api.model
    def get_current_user_features(self):
        user_company_ids = set(self.env.user.company_ids._ids)
        filter_company_ids = user_company_ids.intersection(self.env.companies._ids)
        features_by_company = {company_id: features for company_id, features in self._get_all_features_by_company() if company_id in filter_company_ids}
        if self._is_debug():
            for company, features in features_by_company.items():
                features_by_company[company] = features.union(['debug'])
        return features_by_company

    @api.model
    def _is_feature_activated(self, name, companies=None):
        if companies is None:
            companies = self.env.companies
        return any(name in features for company_id, features in self._get_all_features_by_company() if company_id in companies.ids)
