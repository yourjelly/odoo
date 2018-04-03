# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools
from odoo import models, fields, api
from odoo.tools.safe_eval import safe_eval


class HsnGstReport(models.Model):
    _name = "hsn.gst.report"
    _description = "Hsn gst Statistics"
    _auto = False

    @api.multi
    def _compute_cess_amount(self):
        AccountInvoiceLine = self.env['account.invoice.line']
        cess_group = self.env.ref('l10n_in.cess_group', False)
        AccountTax = self.env['account.tax']
        for record in self.filtered(lambda r: r.invoice_line_ids):
            cess_amount_count = 0
            account_invoice_lines = AccountInvoiceLine.browse(safe_eval(record.invoice_line_ids))
            for account_invoice_line in account_invoice_lines:
                price_unit = account_invoice_line.price_unit * (1 - (account_invoice_line.discount or 0.0) / 100.0)
                tax_lines = account_invoice_line.invoice_line_tax_ids.compute_all(price_unit, account_invoice_line.invoice_id.currency_id,
                    account_invoice_line.quantity, account_invoice_line.product_id, account_invoice_line.invoice_id.partner_id)['taxes']
                for tax_line in tax_lines:
                    tax = AccountTax.browse(tax_line['id'])
                    if cess_group and cess_group.id == tax.tax_group_id.id:
                        cess_amount_count += tax_line.get('amount')
            record.cess_amount = cess_amount_count

    hsn_code = fields.Char("HSN")
    hsn_description = fields.Char("HSN description")
    uom_name = fields.Char("Uom Name")
    product_qty = fields.Float("Product Qty")
    invoice_line_ids = fields.Char("invoice Line ids")
    invoice_month = fields.Char("Invoice Month")
    price_total = fields.Float(string='Total Without Tax')
    invoice_total = fields.Float(string="Invoice Total")
    igst_amount = fields.Float("Integrated Tax Amount")
    cgst_amount = fields.Float("Central Tax Amount")
    sgst_amount = fields.Float("State/UT Tax Amount")
    cess_amount = fields.Float(compute="_compute_cess_amount" ,string="Cess Amount", digits=0)
    company_id = fields.Integer("Company")
    type = fields.Selection([
        ('out_invoice', 'Customer Invoice'),
        ('in_invoice', 'Vendor Bill'),
        ], readonly=True)

    _order = 'invoice_month desc'

    def _select(self):
        select_str = """
            SELECT concat(case when sub.hsn_code is not null
                    then (sub.uom_id, '-', sub.hsn_code, '-', sub.invoice_month, '-', sub.company_id)
                    else (sub.uom_id, '-', sub.hsn_description, '-', sub.invoice_month, '-', sub.company_id)
                    END) AS id,
                array_agg(sub.invoice_line_id) as invoice_line_ids,
                (select sum(amount_total_company_signed) from account_invoice where id = ANY (array_agg(sub.id))) as invoice_total,
                sub.company_id,
                sum(sub.price_total) as price_total,
                sub.hsn_code,
                sub.hsn_description,
                sub.invoice_month,
                sub.uom_name,
                sum(sub.igst_amount) as igst_amount,
                sum(sub.cgst_amount) as cgst_amount,
                sum(sub.sgst_amount) as sgst_amount,
                sum(sub.product_qty) as product_qty,
                sub.type as type
        """
        return select_str

    def _sub_select(self):
        gst_tag_ids = self.get_gst_tag_ids()
        sub_select_str = """
            SELECT ai.id as id,
                ail.id AS invoice_line_id,
                ai.type as type,
                CASE WHEN taxmin.tax_tag_id = ANY(ARRAY[%s,%s]) THEN ail.quantity / 2 ELSE ail.quantity END as product_qty,
                ai.company_id AS company_id,
                pt.l10n_in_hsn_code AS hsn_code,
                pt.hsn_description AS hsn_description,
                to_char(ai.date_invoice, 'MM-YYYY') AS invoice_month,
                CASE WHEN taxmin.tax_tag_id = ANY(ARRAY[%s,%s]) THEN ail.price_subtotal_signed / 2 ELSE ail.price_subtotal_signed END AS price_total,
                u.name as uom_name,
                u.id as uom_id,
                (CASE WHEN taxmin.tax_tag_id = %s THEN (taxmin.amount / 100) * ail.price_subtotal_signed ELSE 0 END) as igst_amount,
                (CASE WHEN taxmin.tax_tag_id = %s THEN (taxmin.amount / 100) * ail.price_subtotal_signed ELSE 0 END) as cgst_amount,
                (CASE WHEN taxmin.tax_tag_id = %s THEN (taxmin.amount / 100) * ail.price_subtotal_signed ELSE 0 END) as sgst_amount
        """%(gst_tag_ids.get('sgst_tag'), gst_tag_ids.get('cgst_tag'),
             gst_tag_ids.get('sgst_tag'), gst_tag_ids.get('cgst_tag'),
             gst_tag_ids.get('igst_tag'), gst_tag_ids.get('cgst_tag'), gst_tag_ids.get('sgst_tag'))
        return sub_select_str

    def _from(self):
        gst_tag_ids = self.get_gst_tag_ids()
        from_str = """
            FROM account_invoice_line ail
                JOIN account_invoice ai ON ai.id = ail.invoice_id
                JOIN res_company comp ON comp.id = ai.company_id
                JOIN res_partner p ON p.id = ai.commercial_partner_id
                LEFT JOIN res_country_state ps ON ps.id = p.state_id
                LEFT JOIN product_product pr ON pr.id = ail.product_id
                LEFT JOIN product_template pt ON pt.id = pr.product_tmpl_id
                LEFT JOIN uom_uom u ON u.id = ail.uom_id
                LEFT join (select atax.id as id,
                    ailts.invoice_line_id as a_invoice_line_id,
                    CASE when atax.amount_type::text = 'group'
                        THEN sum(catax.amount)
                        ELSE sum(atax.amount)
                    END as amount,
                    CASE when atax.amount_type::text = 'group'
                        THEN catt.account_account_tag_id
                        ELSE att.account_account_tag_id
                    END as tax_tag_id
                    FROM account_tax as atax
                    inner join account_invoice_line_tax as ailts ON (ailts.tax_id=atax.id)
                    LEFT JOIN account_tax_account_tag as att ON att.account_tax_id = atax.id
                    LEFT JOIN account_tax_filiation_rel cataxr ON cataxr.parent_tax = atax.id
                    LEFT JOIN account_tax catax ON catax.id = cataxr.child_tax
                    LEFT JOIN account_tax_account_tag as catt ON catt.account_tax_id = catax.id
                    where att.account_account_tag_id = %s or catt.account_account_tag_id = ANY (ARRAY[%s, %s])
                    group by atax.id, a_invoice_line_id, atax.amount_type, att.account_account_tag_id, catt.account_account_tag_id)
                    as taxmin on taxmin.a_invoice_line_id=ail.id
                    where ai.state = ANY (ARRAY['open', 'paid']) and ai.type = ANY (ARRAY['out_invoice','in_invoice']) and taxmin.id IS NOT NULL
        """ %(gst_tag_ids.get('igst_tag'), gst_tag_ids.get('cgst_tag'), gst_tag_ids.get('sgst_tag'))
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
                taxmin.tax_tag_id,
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
            FROM (%s %s %s) as sub
            %s
        )""" % (self._table, self._select(), self._sub_select(), self._from(), self._sub_group_by() , self._group_by()))


    def get_gst_tag_ids(self):
        igst_tag = self.env.ref('l10n_in.igst_tag_tax', False)
        cgst_tag = self.env.ref('l10n_in.cgst_tag_tax', False)
        sgst_tag = self.env.ref('l10n_in.sgst_tag_tax', False)
        return {'igst_tag': igst_tag and igst_tag.id or 0,
                'sgst_tag': sgst_tag and sgst_tag.id or 0,
                'cgst_tag': cgst_tag and cgst_tag.id or 0}
