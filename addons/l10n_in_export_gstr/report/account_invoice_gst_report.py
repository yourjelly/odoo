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
            itc_cess_amount_count = 0
            account_invoice_lines = AccountInvoiceLine.browse(safe_eval(record.invoice_line_ids))
            for account_invoice_line in account_invoice_lines:
                price_unit = account_invoice_line.price_unit * (1 - (account_invoice_line.discount or 0.0) / 100.0)
                tax_lines = account_invoice_line.invoice_line_tax_ids.compute_all(price_unit, account_invoice_line.invoice_id.currency_id,
                    account_invoice_line.quantity, account_invoice_line.product_id, account_invoice_line.invoice_id.partner_id)['taxes']
                for tax_line in tax_lines:
                    tax = AccountTax.browse(tax_line['id'])
                    if cess_group and cess_group.id == tax.tax_group_id.id:
                        cess_amount_count += tax_line.get('amount')
                        itc_cess_amount_count += account_invoice_line.is_eligible_for_itc and tax_line.get('amount') or 0
            record.cess_amount = cess_amount_count
            record.itc_cess_amount = itc_cess_amount_count

    @api.multi
    def _get_all_gst_amount(self):
        igst_group = self.env.ref('l10n_in.igst_group', False)
        igst_group_id  = igst_group and igst_group.id or 0
        for record in self:
            gst_tax_amount = record.price_total * (record.tax_rate/100)
            itc_gst_tax_amount = record.itc_price_total * (record.tax_rate/100)
            if record.tax_group_id ==  igst_group_id:
                record.igst_amount = gst_tax_amount
                record.itc_igst_amount = itc_gst_tax_amount
            else:
                record.cgst_amount = gst_tax_amount / 2
                record.sgst_amount = gst_tax_amount / 2
                record.itc_cgst_amount = itc_gst_tax_amount / 2
                record.itc_sgst_amount = itc_gst_tax_amount / 2

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
    tax_rate = fields.Float("Rate")
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
    supply_type = fields.Selection([('inter_state', 'Inter State'), ('intra_state', 'Intra State')], string="Supply Type")
    refund_reason = fields.Char("Refund Reason")
    refund_invoice_number = fields.Char("Refund Invoice number")
    refund_invoice_date = fields.Char("Refund Invoice Date")
    invoice_total = fields.Float("Invoice Total")
    tax_group_id = fields.Integer("Tax group")
    cess_amount = fields.Float(compute="_compute_cess_amount", string="Cess Amount", digits=0)
    igst_amount = fields.Float(compute="_get_all_gst_amount", string="IGST amount")
    cgst_amount = fields.Float(compute="_get_all_gst_amount", string="CGST amount")
    sgst_amount = fields.Float(compute="_get_all_gst_amount", string="SGST amount")
    itc_type = fields.Selection([('inputs', 'Inputs'),
                                ('capital_goods', 'Capital goods'),
                                ('input_services', 'Input services'),
                                ('ineligible', 'Ineligible')], string="ITC Type")
    itc_cess_amount = fields.Float(compute="_compute_cess_amount", string="ITC Cess Amount", digits=0)
    itc_price_total = fields.Float(string="ITC price total", digits=0)
    itc_igst_amount = fields.Float(compute="_get_all_gst_amount", string="ITC IGST amount")
    itc_cgst_amount = fields.Float(compute="_get_all_gst_amount", string="ITC CGST amount")
    itc_sgst_amount = fields.Float(compute="_get_all_gst_amount", string="ITC SGST amount")

    is_pre_gst = fields.Char("Is Pre GST")
    shipping_bill_number = fields.Char("Shipping Bill Number") #Is Pending
    shipping_bill_date = fields.Char("Shipping Bill Date") #Is pending
    company_id = fields.Integer("Company")

    import_type = fields.Selection([('import_of_services', 'Import of Services'),
                                    ('import_of_goods', 'Import of Goods')], string="Import Type")
    refund_import_type = fields.Selection([('import_of_services','IMPS'),
                                            ('import_of_goods','IMPG'),
                                            ('b2bur', 'B2BUR')], string="Refund import type")
    gst_import_type = fields.Selection([('import', 'Imports'),
                                         ('sez_import', 'Received from SEZ')], string="Import Type")


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
                sub.is_reverse_charge,
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
                sub.itc_type,
                sub.itc_price_total,
                sub.state,
                sub.supply_type,
                '' as shipping_bill_number,
                '' as shipping_bill_date,
                sub.import_type,
                sub.refund_import_type,
                sub.gst_import_type
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
                (CASE WHEN ai.reverse_charge THEN 'Y' ELSE 'N' END) AS is_reverse_charge,
                (CASE WHEN p.state_id = compp.state_id THEN 'intra_state' ELSE 'inter_state' END) as supply_type,
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
                (CASE WHEN ail.is_eligible_for_itc IS True THEN (CASE WHEN pt.type = 'service' THEN 'input_services' ELSE (CASE WHEN pt.is_asset IS True THEN 'capital_goods' ELSE 'inputs' END) END) ELSE 'ineligible' END) as itc_type,
                SUM(CASE WHEN ail.is_eligible_for_itc IS True THEN (CASE WHEN ai.type = ANY (ARRAY['in_refund', 'out_refund']) THEN ail.price_subtotal_signed * -1  ELSE ail.price_subtotal_signed END) * (ail.itc_percentage/100) ELSE 0 END) AS itc_price_total,
                to_char(air.date_invoice, 'DD-MON-YYYY') AS refund_invoice_date,
                (CASE WHEN to_char(air.date_invoice, 'DD-MM-YYYY') < '01-07-2017' THEN 'Y' ELSE 'N' END) AS is_pre_gst,
                taxmin.tax_group_id AS tax_group_id,
                (CASE WHEN ai.gst_import_type IS NOT NULL THEN (CASE WHEN pt.type = 'service' THEN 'import_of_services' ELSE 'import_of_goods' END) ELSE NULL END) as import_type,
                (CASE WHEN ai.gst_import_type IS NOT NULL THEN (CASE WHEN pt.type = 'service' THEN 'import_of_services' ELSE 'import_of_goods' END) ELSE NULL END) as refund_import_type,
                ai.gst_import_type as gst_import_type

        """
        return sub_select_str

    def _from(self):
        from_str = """
            FROM account_invoice_line ail
                JOIN account_invoice ai ON ai.id = ail.invoice_id
                JOIN res_currency cr ON cr.id = ai.currency_id
                JOIN res_company comp ON comp.id = ai.company_id
                JOIN res_partner compp ON compp.id = comp.partner_id
                JOIN res_partner p ON p.id = ai.commercial_partner_id
                LEFT JOIN res_country_state ps ON ps.id = p.state_id
                LEFT JOIN product_product pr ON pr.id = ail.product_id
                LEFT JOIN product_template pt ON pt.id = pr.product_tmpl_id
                LEFT JOIN account_invoice_refund_reason airr ON airr.id = ai.refund_reason_id
                LEFT JOIN account_invoice air on air.id = ai.refund_invoice_id
                LEFT join (select atax.id as id,
                    ailts.invoice_line_id as a_invoice_line_id,
                    CASE when atax.amount_type::text = 'group'
                        THEN sum(catax.amount)
                    ELSE sum(atax.amount)
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
                where ai.state = ANY (ARRAY['open', 'paid'])
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
                p.state_id,
                compp.state_id,
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
                air.gst_invoice_type,
                pt.type,
                pt.is_asset
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
            sub.is_reverse_charge,
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
            sub.itc_type,
            sub.itc_price_total,
            sub.supply_type,
            sub.state,
            sub.import_type,
            sub.refund_import_type,
            sub.gst_import_type
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
