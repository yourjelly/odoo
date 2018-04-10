# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools
from odoo import models, fields, api
from odoo.tools.safe_eval import safe_eval


class AccountInvoiceGstReport(models.Model):

    _name = "account.invoice.gst.report"
    _inherit = "generic.account.gst.report"
    _description = "Invoices Statistics"
    _auto = False
    _order = 'invoice_date desc'

    invoice_line_ids = fields.Char("invoice Line ids")
    company_id = fields.Integer("Company")
    invoice_date = fields.Char("Date")
    invoice_month = fields.Char("Invoice Month")
    invoice_number = fields.Char("Invoice Number")
    partner_name = fields.Char("Partner name")
    place_of_supply = fields.Char("Place of Supply")
    partner_gstn = fields.Char("Partner GSTN")
    price_total = fields.Float('Total Without Tax', digits= (16,2))
    tax_rate = fields.Float("Rate")
    is_reverse_charge = fields.Char("Reverse Charge")
    invoice_total = fields.Float("Invoice Total", digits= (16,2))
    tax_group_id = fields.Integer("Tax group")
    is_pre_gst = fields.Selection([('yes', 'Y'), ('no', 'N')], string="Is Pre GST")
    exp_invoice_type = fields.Selection([('wpay','WPAY'), ('wopay','WOPAY')], string="Export Type")
    supply_type = fields.Selection([('inter_state', 'Inter State'), ('intra_state', 'Intra State')], string="Supply Type")
    import_product_type = fields.Selection([('import_of_services', 'Import of Services'), ('import_of_goods', 'Import of Goods')], string="Import Product Type")
    gst_import_type = fields.Selection([('import', 'Imports'), ('sez_import', 'Received from SEZ')], string="Import Type")
    type = fields.Selection([
        ('out_invoice', 'Customer Invoice'), ('in_invoice', 'Vendor Bill'),
        ('out_refund', 'Customer Credit Note'), ('in_refund', 'Vendor Credit Note'),
        ], readonly=True)
    state = fields.Selection([
        ('draft', 'Draft'), ('open', 'Open'),
        ('paid', 'Paid'), ('cancel', 'Cancelled')
        ], string='Invoice Status', readonly=True)
    b2b_invoice_type = fields.Selection([
        ('regular','Regular'),('deemed_exp','Deemed Exp'),
        ('sewp','SEZ supplies with payment'), ('sewop','SEZ supplies without payment')
        ], string="GST Invoice Type")
    itc_type = fields.Selection([
        ('ineligible', 'Ineligible'), ('inputs', 'Inputs'),
        ('capital_goods', 'Capital goods'), ('input_services', 'Input services'),
        ], string="ITC Type")
    cess_amount = fields.Float(compute="_compute_cess_amount", string="Cess Amount", digits= (16,2))
    igst_amount = fields.Float(compute="_get_all_gst_amount", string="IGST amount", digits= (16,2))
    cgst_amount = fields.Float(compute="_get_all_gst_amount", string="CGST amount", digits= (16,2))
    sgst_amount = fields.Float(compute="_get_all_gst_amount", string="SGST amount", digits= (16,2))
    itc_cess_amount = fields.Float(compute="_compute_cess_amount", string="ITC Cess Amount", digits= (16,2))
    itc_price_total = fields.Float(string="ITC price total", digits= (16,2))
    itc_igst_amount = fields.Float(compute="_get_all_gst_amount", string="ITC IGST amount", digits= (16,2))
    itc_cgst_amount = fields.Float(compute="_get_all_gst_amount", string="ITC CGST amount", digits= (16,2))
    itc_sgst_amount = fields.Float(compute="_get_all_gst_amount", string="ITC SGST amount", digits= (16,2))
    refund_reason = fields.Char("Refund Reason")
    refund_invoice_number = fields.Char("Refund Invoice number")
    refund_invoice_date = fields.Char("Refund Invoice Date")
    refund_invoice_type = fields.Selection([('b2cl','B2CL'), ('expwp','EXPWP'), ('expwop','EXPWOP')], string="UR Type")
    refund_document_type = fields.Selection([('credit_note', 'C'), ('debit_note', 'D'), ('refund_note', 'R')], string="Refund Document Type")
    refund_import_type = fields.Selection([
        ('import_of_services','IMPS'),
        ('import_of_goods','IMPG'), ('b2bur', 'B2BUR')
        ], string="Refund import type")
    is_ecommerce = fields.Selection([('yes', 'Y'), ('no', 'N')], string="Is E-commerce") #Is pending
    shipping_bill_number = fields.Char("Shipping Bill Number") #Is Pending
    shipping_bill_date = fields.Char("Shipping Bill Date") #Is pending
    port_code = fields.Char("Port Code") #Is pending
    ecommerce_gstn = fields.Char("E-commerce GSTIN") #Is pending

    @api.multi
    def _compute_cess_amount(self):
        AccountInvoiceLine = self.env['account.invoice.line']
        for record in self.filtered(lambda r: r.invoice_line_ids):
            account_invoice_lines = AccountInvoiceLine.browse(safe_eval(record.invoice_line_ids))
            cess_amount = self._get_cess_amount(account_invoice_lines)
            record.cess_amount = cess_amount.get('cess_amount')
            record.itc_cess_amount = cess_amount.get('itc_cess_amount')

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

    def _select(self):
        select_str = """
            SELECT concat(sub.id, '-', sub.tax_id, '-', sub.company_id) AS id,
                array_agg(sub.invoice_line_id) AS invoice_line_ids,
                sub.company_id,
                SUM(sub.price_total) AS price_total,
                sub.tax_rate AS tax_rate,
                sub.tax_group_id AS tax_group_id,
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
                sub.refund_reason,
                sub.refund_invoice_number,
                sub.refund_invoice_date,
                sub.is_pre_gst,
                sub.itc_type,
                sub.itc_price_total,
                sub.state,
                sub.supply_type,
                sub.import_product_type,
                sub.refund_import_type,
                sub.gst_import_type,
                '' AS port_code,
                '' AS is_ecommerce,
                '' AS ecommerce_gstn,
                '' AS shipping_bill_number,
                '' AS shipping_bill_date
        """
        return select_str

    def _sub_select(self):
        sub_select_str = """
            SELECT ai.id AS id,
                ai.company_id AS company_id,
                ai.type AS type,
                ai.state AS state,
                ai.number AS invoice_number,
                ai.gst_import_type AS gst_import_type,
                ail.id AS invoice_line_id,
                p.vat AS partner_gstn,
                p.name AS partner_name,
                taxmin.amount AS tax_rate,
                taxmin.id AS tax_id,
                air.number AS refund_invoice_number,
                taxmin.tax_group_id AS tax_group_id,
                to_char(air.date_invoice, 'DD-MON-YYYY') AS refund_invoice_date,
                to_char(ai.date_invoice, 'DD-MON-YYYY') AS invoice_date,
                to_char(ai.date_invoice, 'MM-YYYY') AS invoice_month,
                (CASE WHEN ai.reverse_charge THEN 'Y' ELSE 'N' END) AS is_reverse_charge,
                (CASE WHEN airr.name IS NOT NULL THEN concat(airr.code,'-',airr.name) END) AS refund_reason,
                (CASE WHEN p.state_id = cp.state_id THEN 'intra_state' ELSE 'inter_state' END) AS supply_type,
                (CASE WHEN to_char(air.date_invoice, 'DD-MM-YYYY') < '01-07-2017' THEN 'yes' ELSE 'no' END) AS is_pre_gst,
                (CASE WHEN ai.type = ANY (ARRAY['out_invoice', 'our_refund']) AND ps.l10n_in_tin IS NOT NULL THEN concat(ps.l10n_in_tin,'-',ps.name)
                    WHEN ai.type = ANY (ARRAY['in_invoice', 'in_refund']) and cps.l10n_in_tin IS NOT NULL THEN concat(cps.l10n_in_tin,'-',cps.name)
                    ELSE NULL END) AS place_of_supply,
                (CASE WHEN ai.type = 'in_refund' THEN 'debit_note' WHEN ai.type = 'out_refund' THEN 'credit_note' ELSE '' END) AS refund_document_type,
                (CASE WHEN ai.gst_export_type = ANY (ARRAY['dewp', 'dewop']) THEN 'de'
                    ELSE (CASE WHEN ai.gst_export_type IS NULL THEN 'regular' ELSE ai.gst_export_type END)
                    END) AS b2b_invoice_type,
                (CASE WHEN ai.gst_import_type IS NOT NULL
                    THEN (CASE WHEN pt.type = 'service' THEN 'import_of_services' ELSE 'import_of_goods' END)
                    ELSE NULL END) AS import_product_type,
                (CASE WHEN ai.gst_import_type IS NOT NULL THEN (CASE WHEN pt.type = 'service' THEN 'import_of_services' ELSE 'import_of_goods' END)
                    ELSE NULL END) AS refund_import_type,
                (CASE WHEN ail.is_eligible_for_itc IS True THEN
                    (CASE WHEN pt.type = 'service' THEN 'input_services' ELSE
                        (CASE WHEN pt.is_asset IS True THEN 'capital_goods' ELSE 'inputs' END) END)
                    ELSE 'ineligible' END) AS itc_type,
                (CASE WHEN ai.gst_export_type = ANY (ARRAY['dewp', 'sewp']) THEN 'wapy'
                    WHEN ai.gst_export_type = ANY (ARRAY['dewop', 'sewop']) THEN 'wopay' ELSE NULL END) AS exp_invoice_type,
                (CASE WHEN ai.gst_export_type = ANY (ARRAY['dewp', 'sewp']) THEN 'expwp'
                    WHEN ai.gst_export_type = ANY (ARRAY['dewop', 'sewop']) THEN 'expwop' ELSE 'b2cl' END) AS refund_invoice_type,
                (CASE WHEN ai.type = ANY (ARRAY['in_refund', 'out_refund']) THEN ai.amount_total_company_signed * -1
                    ELSE ai.amount_total_company_signed END) AS invoice_total,
                SUM(CASE WHEN ai.type = ANY (ARRAY['in_refund', 'out_refund']) THEN ail.price_subtotal_signed * -1
                    ELSE ail.price_subtotal_signed END) AS price_total,
                SUM(CASE WHEN ail.is_eligible_for_itc IS True THEN
                        (CASE WHEN ai.type = ANY (ARRAY['in_refund', 'out_refund'])
                            THEN ail.price_subtotal_signed * -1
                            ELSE ail.price_subtotal_signed END) * (ail.itc_percentage/100)
                        ELSE 0 END) AS itc_price_total
        """
        return sub_select_str

    def _from(self):
        from_str = """
            FROM account_invoice_line ail
                JOIN account_invoice ai ON ai.id = ail.invoice_id
                JOIN res_company aic ON aic.id = ai.company_id
                JOIN res_partner cp ON cp.id = aic.partner_id
                LEFT JOIN res_country_state cps ON cps.id = cp.state_id
                JOIN res_partner p ON p.id = ai.commercial_partner_id
                LEFT JOIN res_country_state ps ON ps.id = p.state_id
                LEFT JOIN product_product pr ON pr.id = ail.product_id
                LEFT JOIN product_template pt ON pt.id = pr.product_tmpl_id
                LEFT JOIN account_invoice_refund_reason airr ON airr.id = ai.refund_reason_id
                LEFT JOIN account_invoice air on air.id = ai.refund_invoice_id
                JOIN (select atax.id AS id,
                    ailts.invoice_line_id AS a_invoice_line_id,
                    CASE WHEN atax.amount_type::text = 'group'
                        THEN SUM(catax.amount)
                    ELSE SUM(atax.amount)
                    END AS amount,
                    CASE WHEN atax.amount_type::text = 'group'
                        THEN MAX(catax.tax_group_id)
                    ELSE atax.tax_group_id
                    END AS tax_group_id
                    from account_tax AS atax
                    INNER join account_invoice_line_tax as ailts ON (ailts.tax_id=atax.id)
                    LEFT JOIN account_tax_filiation_rel cataxr ON cataxr.parent_tax = atax.id
                    LEFT JOIN account_tax catax ON catax.id = cataxr.child_tax
                    GROUP BY atax.id, a_invoice_line_id, atax.amount_type, atax.tax_group_id)
                AS taxmin ON taxmin.a_invoice_line_id=ail.id
                where ai.state = ANY (ARRAY['open', 'paid']) and taxmin.tax_group_id = ANY (ARRAY[%s, %s, %s])
        """%tuple(self._get_tax_group_ids().values())
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
                cp.state_id,
                cps.l10n_in_tin,
                cps.name,
                ai.type,
                ai.state,
                ai.number,
                ai.amount_total_company_signed,
                ai.gst_export_type,
                air.number,
                air.date_invoice,
                taxmin.tax_group_id,
                taxmin.id,
                taxmin.amount,
                airr.name,
                airr.code,
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
            sub.import_product_type,
            sub.refund_import_type,
            sub.gst_import_type
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
