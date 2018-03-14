# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Indian - Export GSTR',
    'version': '1.0',
    'description': """
Indian Accounting GSTR Export.
====================================
This module allows to export csv file for GSTR-1 report.
GSTR-1 is a monthly or quarterly return to be filed by regular dealers.
The return contains details of all outward supplies made during the month.
The return is divided into 13 sections:
    * B2B Invoice: Sales from a registered seller to a registered buyer.
    * B2C (SMALL) Invoice: Sales from a registered seller to a unregistered buyers.
    * B2C (Large) Invoice: Sales from registered seller to unregistered buyer > 2.5 lakh
    * Credit/Debit Notes: Sales return will be classified under credit note and vice versa
    * Export Invoice: Sales to Countries outside india.
    * Tax Liability (Advance Payment): Advance Payment received by Customers.
    * Tax already paid on invoices: Invoices on which on advance was received and tax has already been paid.
  """,
    'category': 'Localization',
    'depends': [
        'l10n_in'
    ],
    'data': [
        'data/account_invoice_refund_reason_data.xml',
        'data/gst.port.code.csv',
        'security/ir.model.access.csv',
        'wizard/account_invoice_refund_views.xml',
        'wizard/export_gst_return_csv_views.xml',
        'views/account_invoice_views.xml',
        'views/product_template_views.xml',
        'views/res_partner_views.xml',
        'views/res_config_settings_views.xml',
    ],
}
