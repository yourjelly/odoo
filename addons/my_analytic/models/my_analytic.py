from collections import defaultdict

from odoo import models, fields, api, _
from odoo.tools import float_compare
from odoo.exceptions import ValidationError


class AnalyticRepartition(models.Model):
    _name = 'my.analytic.repartition'
    _description = "Analytic Repartition"

    parent_id = fields.Many2one('my.analytic.tag')
    tag_id = fields.Many2one('my.analytic.tag')
    percentage = fields.Float()

    def name_get(self):
        return [(record.id, f"{record.tag_id.name} {record.percentage}%") for record in self]


class AnalyticTag(models.Model):
    _name = 'my.analytic.tag'
    _description = "Analytic Tag"

    name = fields.Char()
    repartition_ids = fields.One2many('my.analytic.repartition', 'parent_id')

    @api.constrains('repartition_ids')
    def _check_repartition_ids(self):
        for tag in self:
            if (
                tag.repartition_ids
                and not float_compare(sum(tag.repartition_ids.mapped('percentage')), 100, precision_digits=2) == 0
            ):
                raise ValidationError(_("Sum of percentages must be 100"))


class AnalyticLine(models.Model):
    _name = 'my.analytic.line'
    _description = "Analytic Line"

    name = fields.Char()
    amount = fields.Float()
    tag_ids = fields.Many2many('my.analytic.tag')
    repartition = fields.Binary(compute='_compute_repartition')
    repartition_string = fields.Html(compute='_compute_repartition_string')

    @api.depends('amount', 'tag_ids')
    def _compute_repartition(self):
        self.env.cr.execute(f"""
            SELECT originator_id,
                   tag_id,
                   SUM(amount_detail)
              FROM ({self.env['my.analytic.line.detail']._table_query}) sub
          GROUP BY originator_id, tag_id
        """, [self.ids])
        groupbyline = defaultdict(dict)
        for line_id, tag_id, amount in self.env.cr.fetchall():
            groupbyline[line_id][tag_id] = amount
        for line in self:
            line.repartition = groupbyline[line.id]

    @api.depends('repartition')
    def _compute_repartition_string(self):
        for line in self:
            line.repartition_string = "<br>".join((
                f"{self.env['my.analytic.tag'].browse(tag_id).name}: {amount}"
                for tag_id, amount in line.repartition.items()
            ))

    @api.model
    def read_group(self, domain, fields, groupby, offset=0, limit=None, orderby=False, lazy=True):
        print(domain)
        return super().read_group(domain, fields, groupby, offset, limit, orderby, lazy)

    def search(self, domain, offset=0, limit=None, order=None, count=False):
        print(domain)
        return super().search(domain, offset, limit, order, count)


class MyAnalyticLineDetail(models.Model):
    _name = 'my.analytic.line.detail'
    _description = "Analytic Line"
    _auto = False
    _inherits = {'my.analytic.line': 'originator_id'}

    amount_detail = fields.Float()
    originator_id = fields.Many2one('my.analytic.line')
    tag_id = fields.Many2one('my.analytic.tag')

    @property
    def _table_query(self):
        return """
            WITH RECURSIVE computation(originator_id, tag_id, amount_detail) AS (
                SELECT line.id,
                       rel.my_analytic_tag_id,
                       line.amount
                  FROM my_analytic_line line
                  JOIN my_analytic_line_my_analytic_tag_rel rel ON line.id = rel.my_analytic_line_id
              UNION ALL
                SELECT computation.originator_id,
                       repartition.tag_id,
                       computation.amount_detail * repartition.percentage / 100
                  FROM my_analytic_repartition repartition,
                       computation
                 WHERE computation.tag_id = repartition.parent_id
            )
            SELECT *,
                   originator_id::text || '-' || tag_id AS id
              FROM computation
        """
