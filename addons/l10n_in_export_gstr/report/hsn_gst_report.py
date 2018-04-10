# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools
from odoo import models, fields, api
from odoo.tools.safe_eval import safe_eval


class HsnGstReport(models.Model):

    _inherit = "generic.account.gst.report"
    _name = "hsn.gst.report"
    _description = "Hsn gst Statistics"
    _auto = False

    @api.multi
    def _compute_cess_amount(self):
        AccountInvoiceLine = self.env['account.invoice.line']
        for record in self.filtered(lambda r: r.invoice_line_ids):
            account_invoice_lines = AccountInvoiceLine.browse(safe_eval(record.invoice_line_ids))
            record.cess_amount = self._get_cess_amount(account_invoice_lines).get('cess_amount')

    hsn_code = fields.Char("HSN")
    hsn_description = fields.Char("HSN description")
    uom_name = fields.Char("Uom Name")
    product_qty = fields.Float("Product Qty", digits= (16,2))
    invoice_line_ids = fields.Char("invoice Line ids")
    invoice_month = fields.Char("Invoice Month")
    price_total = fields.Float(string='Total Without Tax', digits= (16,2))
    invoice_total = fields.Float(string="Invoice Total", digits= (16,2))
    igst_amount = fields.Float("Integrated Tax Amount", digits= (16,2))
    cgst_amount = fields.Float("Central Tax Amount", digits= (16,2))
    sgst_amount = fields.Float("State/UT Tax Amount", digits= (16,2))
    cess_amount = fields.Float(compute="_compute_cess_amount" ,string="Cess Amount", digits= (16,2))
    company_id = fields.Integer("Company")
    type = fields.Selection([
        ('out_invoice', 'Customer Invoice'),
        ('in_invoice', 'Vendor Bill'),
        ], readonly=True)

    _order = 'invoice_month desc'

    def _select(self):
        select_str = """
            SELECT concat(CASE WHEN sub.hsn_code IS NOT NULL
                    THEN (sub.uom_id, '-', sub.hsn_code, '-', sub.invoice_month, '-', sub.company_id)
                    ELSE (sub.uom_id, '-', sub.hsn_description, '-', sub.invoice_month, '-', sub.company_id)
                    END) AS id,
                array_agg(sub.invoice_line_id) AS invoice_line_ids,
                (SELECT SUM(amount_total_company_signed) FROM account_invoice WHERE id = ANY (array_agg(sub.id))) AS invoice_total,
                sub.company_id,
                sum(sub.price_total) AS price_total,
                sub.hsn_code,
                sub.hsn_description,
                sub.invoice_month,
                sub.uom_name,
                sum(sub.igst_amount) AS igst_amount,
                sum(sub.cgst_amount) AS cgst_amount,
                sum(sub.sgst_amount) AS sgst_amount,
                sum(sub.product_qty) AS product_qty,
                sub.type AS type
        """
        return select_str

    def _sub_select(self):
        tax_group = self._get_tax_group_ids()
        sub_select_str = """
            SELECT ai.id AS id,
                ail.id AS invoice_line_id,
                ai.type AS type,
                CASE WHEN taxmin.tax_group_id = ANY(ARRAY[{sgst_group}, {cgst_group}]) THEN ail.quantity / 2 ELSE ail.quantity END AS product_qty,
                ai.company_id AS company_id,
                pt.l10n_in_hsn_code AS hsn_code,
                pt.hsn_description AS hsn_description,
                to_char(ai.date_invoice, 'MM-YYYY') AS invoice_month,
                CASE WHEN taxmin.tax_group_id = ANY(ARRAY[{sgst_group}, {cgst_group}]) THEN ail.price_subtotal_signed / 2 ELSE ail.price_subtotal_signed END AS price_total,
                u.name AS uom_name,
                u.id AS uom_id,
                (CASE WHEN taxmin.tax_group_id = {igst_group} THEN (taxmin.amount / 100) * ail.price_subtotal_signed ELSE 0 END) AS igst_amount,
                (CASE WHEN taxmin.tax_group_id = {sgst_group} THEN (taxmin.amount / 100) * ail.price_subtotal_signed ELSE 0 END) AS cgst_amount,
                (CASE WHEN taxmin.tax_group_id = {cgst_group} THEN (taxmin.amount / 100) * ail.price_subtotal_signed ELSE 0 END) AS sgst_amount
        """.format(igst_group = tax_group.get('igst_group'), sgst_group = tax_group.get('sgst_group'), cgst_group = tax_group.get('cgst_group'))
        return sub_select_str

    def _from(self):
        tax_group = self._get_tax_group_ids()
        from_str = """
            FROM account_invoice_line ail
                JOIN account_invoice ai ON ai.id = ail.invoice_id
                JOIN res_company comp ON comp.id = ai.company_id
                JOIN res_partner p ON p.id = ai.commercial_partner_id
                LEFT JOIN res_country_state ps ON ps.id = p.state_id
                LEFT JOIN product_product pr ON pr.id = ail.product_id
                LEFT JOIN product_template pt ON pt.id = pr.product_tmpl_id
                LEFT JOIN uom_uom u ON u.id = ail.uom_id
                LEFT JOIN (SELECT atax.id AS id,
                    ailts.invoice_line_id AS a_invoice_line_id,
                    CASE WHEN atax.amount_type::text = 'group'
                        THEN SUM(catax.amount)
                        ELSE SUM(atax.amount)
                    END AS amount,
                    CASE WHEN atax.amount_type::text = 'group'
                        THEN catax.tax_group_id
                    ELSE atax.tax_group_id
                    END AS tax_group_id

                    FROM account_tax AS atax
                    INNER JOIN account_invoice_line_tax AS ailts ON (ailts.tax_id=atax.id)
                    LEFT JOIN account_tax_filiation_rel cataxr ON cataxr.parent_tax = atax.id
                    LEFT JOIN account_tax catax ON catax.id = cataxr.child_tax
                    WHERE atax.tax_group_id = %s OR catax.tax_group_id = ANY (ARRAY[%s, %s])
                    GROUP BY atax.id, a_invoice_line_id, atax.amount_type, atax.tax_group_id, catax.tax_group_id)
                    AS taxmin on taxmin.a_invoice_line_id=ail.id
                    WHERE ai.state = ANY (ARRAY['open', 'paid']) AND ai.type = ANY (ARRAY['out_invoice','in_invoice']) AND taxmin.id IS NOT NULL
        """ %(tax_group.get('igst_group'), tax_group.get('cgst_group'), tax_group.get('sgst_group'))
        return from_str

    def _sub_group_by(self):
        sub_group_by_str = """
            GROUP BY ai.id,
                ail.id,
                ai.company_id,
                ai.type,
                pt.l10n_in_hsn_code,
                pt.hsn_description,
                u.name,
                u.id,
                taxmin.tax_group_id,
                taxmin.amount,
                ai.date_invoice
        """
        return sub_group_by_str

    def _group_by(self):
        group_by_str = """
        GROUP BY
            sub.company_id,
            sub.invoice_month,
            sub.hsn_code,
            sub.hsn_description,
            sub.uom_name,
            sub.uom_id,
            sub.type
        """
        return group_by_str

    @api.model_cr
    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""CREATE or REPLACE VIEW %s as (
            %s
            FROM (%s %s %s) AS sub
            %s
        )""" % (self._table, self._select(), self._sub_select(), self._from(), self._sub_group_by() , self._group_by()))
