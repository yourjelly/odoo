# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools
from odoo import models, fields, api


class DocsGstReport(models.Model):
    _name = "docs.gst.report"
    _description = "Documents GST report"
    _auto = False

    document_type = fields.Selection([('outward', 'Invoice for outward supply'),
                                      ('creditnote', 'Credit Note'),
                                      ('debitnote', 'Debit Note')], string="Nature of Document")
    num_from = fields.Char("Sr. No. From")
    num_to = fields.Char("Sr. No. To")
    total_number = fields.Integer("Total Number")
    cancelled = fields.Integer("Cancelled")
    invoice_month = fields.Char("Invoice Month")
    company_id = fields.Integer("Company")

    def _select(self):
        select_str = """
            SELECT
                concat(sub.id,'-',sub.document_type,'-',sub.invoice_month) AS id,
                sub.company_id,
                sub.document_type,
                MIN(sub.invoice_number) as num_from,
                MAX(sub.invoice_number) as num_to,
                COUNT(sub.invoice_number) as total_number,
                SUM(sub.cancelled) as cancelled,
                sub.invoice_month
        """
        return select_str

    def _sub_select(self):
        sub_select_str = """
            SELECT aj.id as id,
                aj.company_id,
                ai.number AS invoice_number,
                to_char(ai.date_invoice, 'MM-YYYY') AS invoice_month,
                (CASE WHEN ai.type = 'out_invoice'
                        THEN 'outward'
                      WHEN ai.type = 'in_refund'
                        THEN 'debitnote'
                      WHEN ai.type = 'out_refund'
                        THEN 'creditnote'
                      ELSE NULL
                      END) AS document_type,
                (CASE WHEN ai.state = 'cancel'
                        THEN 1
                      ELSE 0
                      END) AS cancelled
        """
        return sub_select_str

    def _from(self):
        from_str = """
            FROM account_journal aj
                JOIN account_invoice ai ON ai.journal_id = aj.id
                where ai.state = ANY (ARRAY['open','paid','cancel'])
        """
        return from_str

    def _sub_group_by(self):
        sub_group_by_str = """
            GROUP BY aj.id,
                aj.company_id,
                ai.date_invoice,
                ai.number,
                ai.type,
                ai.state
        """
        return sub_group_by_str

    def _group_by(self):
        group_by_str = """
        GROUP BY
            sub.id,
            sub.company_id,
            sub.document_type,
            sub.invoice_month,
            sub.cancelled
        """
        return group_by_str

    @api.model_cr
    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""CREATE or REPLACE VIEW %s as (
            %s
            FROM (%s %s %s) as sub
            %s
        )""" % (self._table, self._select(), self._sub_select(), self._from(), self._sub_group_by(), self._group_by()))
