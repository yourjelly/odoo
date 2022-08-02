# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    # Defaults
    default_invoice_policy = fields.Selection(
        selection=[
            ('order', "Invoice what is ordered"),
            ('delivery', "Invoice what is delivered"),
        ],
        string="Invoicing Policy",
        default='order',
        default_model='product.template')

    # Groups
    group_auto_done_setting = fields.Boolean(
        string="Lock Confirmed Sales", implied_group='sale.group_auto_done_setting')
    group_proforma_sales = fields.Boolean(
        string="Pro-Forma Invoice", implied_group='sale.group_proforma_sales',
        help="Allows you to send pro-forma invoice.")
    group_warning_sale = fields.Boolean("Sale Order Warnings", implied_group='sale.group_warning_sale')

    # Company setup
    automatic_invoice = fields.Boolean(
        related='company_id.sale_automatic_invoice',
        readonly=False,
        # previously config_parameter='sale.automatic_invoice',
    )
    deposit_default_product_id = fields.Many2one(
        related='company_id.sale_down_payment_product_id',
        readonly=False,
        # previously config_parameter='sale.default_deposit_product_id',
    )
    confirmation_mail_template_id = fields.Many2one(
        related='company_id.sale_order_confirmation_mail_template_id',
        readonly=False,
        # previously config_parameter='sale.default_confirmation_template',
    )
    invoice_mail_template_id = fields.Many2one(
        related='company_id.sale_order_invoicing_mail_template_id',
        readonly=False,
        # previously config_parameter='sale.default_invoice_email_template',
    )
    quotation_validity_days = fields.Integer(
        related='company_id.quotation_validity_days',
        readonly=False,)
    portal_confirmation_sign = fields.Boolean(
        related='company_id.portal_confirmation_sign',
        readonly=False)
    portal_confirmation_pay = fields.Boolean(
        related='company_id.portal_confirmation_pay',
        readonly=False)

    # Modules
    module_delivery = fields.Boolean("Delivery Methods")
    module_delivery_bpost = fields.Boolean("bpost Connector")
    module_delivery_dhl = fields.Boolean("DHL Express Connector")
    module_delivery_easypost = fields.Boolean("Easypost Connector")
    module_delivery_fedex = fields.Boolean("FedEx Connector")
    module_delivery_sendcloud = fields.Boolean("Sendcloud Connector")
    module_delivery_ups = fields.Boolean("UPS Connector")
    module_delivery_usps = fields.Boolean("USPS Connector")

    module_product_email_template = fields.Boolean("Specific Email")
    module_sale_amazon = fields.Boolean("Amazon Sync")
    module_sale_loyalty = fields.Boolean("Coupons & Loyalty")
    module_sale_margin = fields.Boolean("Margins")

    #=== CRUD METHODS ===#

    @api.onchange('default_invoice_policy')
    def _onchange_default_invoice_policy(self):
        if self.default_invoice_policy != 'order':
            self.automatic_invoice = False
