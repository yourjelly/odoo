# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools
from odoo import models, fields, api
from odoo.tools.safe_eval import safe_eval


class AccountInvoiceGstReport(models.Model):
    _name = "account.invoice.gst.report"
    _description = "Invoices Statistics"
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

    invoice_line_ids = fields.Char("invoice Line ids")
    invoice_date = fields.Char("Date")
    invoice_month = fields.Char("Invoice Month")
    invoice_number = fields.Char("Invoice Number")
    partner_name = fields.Char(string="Parnter name")
    place_of_supply = fields.Char(string="Place of Supply")
    partner_gstn = fields.Char(string="Parnter GSTN")
    price_total = fields.Float(string='Total Without Tax')
    type = fields.Selection([
        ('out_invoice', 'Customer Invoice'),
        ('in_invoice', 'Vendor Bill'),
        ('out_refund', 'Customer Credit Note'),
        ('in_refund', 'Vendor Credit Note'),
        ], readonly=True)
    state = fields.Selection([
        ('draft', 'Draft'),
        ('open', 'Open'),
        ('paid', 'Paid'),
        ('cancel', 'Cancelled')
        ], string='Invoice Status', readonly=True)
    tax_rate = fields.Char("Rate")
    is_reverse_charge = fields.Char("Reverse Charge")
    port_code = fields.Char("Port Code")
    ecommerce_gstn = fields.Char("E-commerce GSTIN")
    is_ecommerce = fields.Char("Is E-commerce")
    b2b_invoice_type = fields.Selection([('R','Regular'),('DE','Deemed Exp'),
                                         ('SEWP','SEZ supplies with payment'),
                                         ('SEWOP','SEZ supplies without payment')], string="GST Invoice Type")
    exp_invoice_type = fields.Selection([('WPAY','WPAY'),
                                         ('WOPAY','WOPAY')], string="Export Type")
    refund_invoice_type = fields.Selection([('B2CL','B2CL'),
                                         ('EXPWP','EXPWP'),
                                         ('EXPWOP','EXPWP')], string="UR Type")
    refund_document_type = fields.Selection([('C', 'C'), ('D', 'D'), ('R', 'R')], string="Refund Document Type")
    refund_reason = fields.Char("Refund Reason")
    refund_invoice_number = fields.Char("Refund Invoice number")
    refund_invoice_date = fields.Char("Refund Invoice Date")
    invoice_total = fields.Float("Invoice Total")
    tax_group_id = fields.Integer("Tax group")
    cess_amount = fields.Float(compute="_compute_cess_amount" ,string="Cess Amount", digits=0)
    is_pre_gst = fields.Char("Is Pre GST")
    shipping_bill_number = fields.Char("Shipping Bill Number") #Is Pending
    shipping_bill_date = fields.Char("Shipping Bill Date") #Is pending
    company_id = fields.Integer("Company")

    _order = 'invoice_date desc'

    def _select(self):
        select_str = """
            SELECT (CASE WHEN sub.tax_id IS NOT NULL THEN concat(sub.id, '-', sub.tax_id, '-', sub.company_id) ELSE concat(sub.id, '-', sub.company_id) END) as id,
                array_agg(sub.invoice_line_id) as invoice_line_ids,
                sub.company_id,
                '' as is_ecommerce,
                '' as ecommerce_gstn,
                sum(sub.price_total) as price_total,
                sub.tax_rate as tax_rate,
                sub.tax_group_id as tax_group_id,
                sub.type,
                sub.invoice_number,
                '' as is_reverse_charge,
                sub.b2b_invoice_type,
                sub.exp_invoice_type,
                sub.refund_invoice_type,
                sub.refund_document_type,
                sub.invoice_total,
                sub.partner_gstn,
                sub.partner_name,
                sub.invoice_date,
                sub.invoice_month,
                sub.place_of_supply,
                '' as port_code,
                sub.refund_reason,
                sub.refund_invoice_number,
                sub.refund_invoice_date,
                sub.is_pre_gst,
                sub.state,
                '' as shipping_bill_number,
                '' as shipping_bill_date
        """
        return select_str

    def _sub_select(self):
        sub_select_str = """
            SELECT ai.id as id,
                ail.id AS invoice_line_id,
                ai.company_id AS company_id,
                to_char(ai.date_invoice, 'DD-MON-YYYY') AS invoice_date,
                to_char(ai.date_invoice, 'MM-YYYY') AS invoice_month,
                (CASE WHEN ps.l10n_in_tin IS NOT NULL THEN concat(ps.l10n_in_tin,'-',ps.name) ELSE NULL END) AS place_of_supply,
                p.vat AS partner_gstn,
                p.name AS partner_name,
                ai.type AS type,
                ai.number AS invoice_number,
                (CASE WHEN ai.gst_invoice_type = ANY (ARRAY['dewp', 'dewop']) THEN 'DE' ELSE UPPER(ai.gst_invoice_type) END) AS b2b_invoice_type,
                (CASE WHEN ai.gst_invoice_type = ANY (ARRAY['dewp', 'sewp']) THEN 'WPAY' WHEN ai.gst_invoice_type = ANY (ARRAY['dewop', 'sewop']) THEN 'WOPAY' ELSE '' END) AS exp_invoice_type,
                (CASE WHEN air.gst_invoice_type = ANY (ARRAY['DEWP', 'SEWP']) THEN 'EXPWP' WHEN air.gst_invoice_type = ANY (ARRAY['DEWOP', 'SEWOP']) THEN 'EXPWOP' ELSE 'B2CL' END) AS refund_invoice_type,
                (CASE WHEN ai.type = 'in_refund' THEN 'D' WHEN ai.type = 'out_refund' THEN 'C' ELSE '' END) AS refund_document_type,
                (CASE WHEN ai.type = ANY (ARRAY['in_refund', 'out_refund']) THEN ai.amount_total_company_signed * -1 ELSE ai.amount_total_company_signed END) AS invoice_total,
                SUM(CASE WHEN ai.type = ANY (ARRAY['in_refund', 'out_refund']) THEN ail.price_subtotal_signed * -1 ELSE ail.price_subtotal_signed END) AS price_total,
                ai.state AS state,
                taxmin.amount AS tax_rate,
                taxmin.id as tax_id,
                (CASE WHEN airr.name IS NOT NULL THEN concat(airr.code,'-',airr.name) END) AS refund_reason,
                air.number AS refund_invoice_number,
                to_char(air.date_invoice, 'DD-MON-YYYY') AS refund_invoice_date,
                (CASE WHEN to_char(air.date_invoice, 'DD-MM-YYYY') < '01-07-2017' THEN 'Y' ELSE 'N' END) AS is_pre_gst,
                taxmin.tax_group_id AS tax_group_id
        """
        return sub_select_str

    def _from(self):
        from_str = """
            FROM account_invoice_line ail
                JOIN account_invoice ai ON ai.id = ail.invoice_id
                JOIN res_currency cr ON cr.id = ai.currency_id
                JOIN res_company comp ON comp.id = ai.company_id
                JOIN res_partner p ON p.id = ai.commercial_partner_id
                LEFT JOIN res_country_state ps ON ps.id = p.state_id
                LEFT JOIN product_product pr ON pr.id = ail.product_id
                LEFT JOIN account_invoice_refund_reason airr ON airr.id = ai.refund_reason_id
                LEFT JOIN account_invoice air on air.id = ai.refund_invoice_id
                LEFT join (select atax.id as id,
                    ailts.invoice_line_id as a_invoice_line_id,
                    CASE when atax.amount_type::text = 'group'
                        THEN sum(catax.amount)::character varying::text
                    ELSE sum(atax.amount)::character varying::text
                    END as amount,
                    CASE when atax.amount_type::text = 'group'
                        THEN max(catax.tax_group_id)
                    ELSE atax.tax_group_id
                    END as tax_group_id
                    from account_tax as atax
                    inner join account_invoice_line_tax as ailts ON (ailts.tax_id=atax.id)
                    LEFT JOIN account_tax_filiation_rel cataxr ON cataxr.parent_tax = atax.id
                    LEFT JOIN account_tax catax ON catax.id = cataxr.child_tax
                    group by atax.id, a_invoice_line_id, atax.amount_type, atax.tax_group_id)
                    as taxmin on taxmin.a_invoice_line_id=ail.id
                    where ai.state = ANY (ARRAY['open', 'paid']
                )
        """
        return from_str

    def _sub_group_by(self):
        sub_group_by_str = """
            GROUP BY ai.id,
                ail.id,
                ai.company_id,
                ai.date_invoice,
                ps.l10n_in_tin,
                ps.name,
                p.vat,
                p.name,
                ai.type,
                ai.state,
                ai.number,
                ai.amount_total_company_signed,
                ai.gst_invoice_type,
                air.number,
                air.date_invoice,
                taxmin.tax_group_id,
                taxmin.id,
                taxmin.amount,
                airr.name,
                airr.code,
                air.gst_invoice_type
        """
        return sub_group_by_str

    def _group_by(self):
        group_by_str = """
        GROUP BY sub.id,
            sub.tax_rate,
            sub.company_id,
            sub.type,
            sub.invoice_number,
            sub.b2b_invoice_type,
            sub.exp_invoice_type,
            sub.refund_invoice_type,
            sub.refund_document_type,
            sub.tax_group_id,
            sub.tax_id,
            sub.invoice_total,
            sub.partner_gstn,
            sub.partner_name,
            sub.invoice_date,
            sub.invoice_month,
            sub.place_of_supply,
            sub.refund_reason,
            sub.refund_invoice_number,
            sub.refund_invoice_date,
            sub.is_pre_gst,
            sub.state
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
