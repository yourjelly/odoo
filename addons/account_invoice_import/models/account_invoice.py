# -*- coding: utf-8 -*-

from odoo import api, models, fields, tools, _
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT
from odoo.osv import expression
from odoo.tests.common import Form

from lxml import etree
from datetime import datetime


DEFAULT_FACTURX_DATE_FORMAT = '%Y%m%d'


class AccountInvoice(models.Model):
    _inherit = 'account.invoice'
    _name = 'account.invoice'

    amount_total_import = fields.Monetary(string='Total (xml)', readonly=True, currency_field='currency_id',
        help='Total amount imported from an e-invoice.')

    @api.model
    def fields_view_get(self, view_id=None, view_type='form', toolbar=False, submenu=False):
        # OVERRIDE
        # Make the partner_id field not required.
        res = super(AccountInvoice, self).fields_view_get(view_id=view_id, view_type=view_type, toolbar=toolbar, submenu=submenu)
        if self._context.get('account_invoice_import_view'):
            doc = etree.XML(res['arch'])
            for node in doc.xpath("//field[@name='partner_id']"):
                if node.attrib.get('required'):
                    node.attrib['required'] = '0'
                if node.attrib.get('modifiers'):
                    node.attrib['modifiers'] = node.attrib['modifiers'].replace('"required": true', '"required": false')
            res['arch'] = etree.tostring(doc, encoding='unicode')
        return res

    @api.model
    def _create_new_empty_account_invoice(self):
        # type must be present in the context to get the right behavior of the _default_journal method (account.invoice).
        # journal_id must be present in the context to get the right behavior of the _default_account method (account.invoice.line).
        # account_invoice_import_view is used to make the partner_id field not required in case of the vendor is not found.
        self_ctx = self.with_context(type='in_invoice', account_invoice_import_view=True)
        journal_id = self_ctx._default_journal().id
        self_ctx = self_ctx.with_context(journal_id=journal_id)

        # self could be a single record (editing) or be empty (new).
        with Form(self_ctx, view='account.invoice_supplier_form') as invoice_form:
            return invoice_form.save()

    @api.multi
    def _get_facturx_export_filename(self):
        ''' Get the Factur-X XML filename of the invoice.
        :return: The Factur-x xml filename.
        '''
        self.ensure_one()
        return 'factur-x.xml'

    @api.multi
    def _export_as_facturx_xml(self):
        ''' Create the Factur-x xml file content.
        :return: The XML content as str.
        '''
        self.ensure_one()

        def format_date(date):
            # Format the date in the Factur-x standard.
            dt = date and datetime.strptime(date, DEFAULT_SERVER_DATE_FORMAT) or datetime.now()
            return dt.strftime(DEFAULT_FACTURX_DATE_FORMAT)

        # Create file content.
        template_values = {
            'record': self,
            'format_date': format_date,
        }
        return self.env.ref('account_invoice_import.account_invoice_facturx_export').render(template_values)

    @api.model
    def _is_facturx_tree(self, tree):
        ''' Detect if the xml tree passed as parameter is part of the Factur-x standard.
        :return: True is the tree is part of the Factur-x standard, False otherwise.
        '''
        return tree.tag == '{urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100}CrossIndustryInvoice'

    @api.multi
    def _import_facturx_invoice(self, tree):
        ''' Extract invoice values from the Factur-x xml tree passed as parameter.

        :param tree: The tree of the Factur-x xml file.
        :return: A dictionary containing account.invoice values to create/update it.
        '''
        amount_total_import = None

        # type must be present in the context to get the right behavior of the _default_journal method (account.invoice).
        # journal_id must be present in the context to get the right behavior of the _default_account method (account.invoice.line).
        # account_invoice_import_view is used to make the partner_id field not required in case of the vendor is not found.
        self_ctx = self.with_context(type='in_invoice', account_invoice_import_view=True)
        journal_id = self_ctx._default_journal().id
        self_ctx = self_ctx.with_context(journal_id=journal_id)

        # self could be a single record (editing) or be empty (new).
        with Form(self_ctx, view='account.invoice_supplier_form') as invoice_form:
            
            # Partner (first step to avoid warning 'Warning! You must first select a partner.').
            elements = tree.xpath('.//ram:SellerTradeParty/ram:SpecifiedTaxRegistration/ram:ID', namespaces=tree.nsmap)
            partner_vat = elements and elements[0].text
            elements = tree.xpath('.//ram:SellerTradeParty/ram:Name', namespaces=tree.nsmap)
            partner_name = elements and elements[0].text
            elements = tree.xpath('.//ram:SellerTradeParty//ram:CompleteNumber', namespaces=tree.nsmap)
            partner_phone = elements and elements[0].text
            elements = tree.xpath('.//ram:SellerTradeParty//ram:URIID[@schemeID=\'SMTP\']', namespaces=tree.nsmap)
            partner_mail = elements and elements[0].text

            if partner_vat:
                partner = self.env['res.partner'].search([('vat', '=', partner_vat)], limit=1)
                if partner:
                    invoice_form.partner_id = partner
            if not invoice_form.partner_id:
                domains = []
                if partner_name:
                    domains.append([('name', 'ilike', partner_name)])
                if partner_phone:
                    domains += [[('phone', '=', partner_phone)], [('mobile', '=', partner_phone)]]
                if partner_mail:
                    domains.append([('email', '=', partner_mail)])
                if domains:
                    partner = self.env['res.partner'].search(expression.OR(domains), limit=1)
                    if partner:
                        invoice_form.partner_id = partner

            # Reference.
            elements = tree.xpath('.//rsm:ExchangedDocument/ram:ID', namespaces=tree.nsmap)
            if elements:
                invoice_form.reference = elements[0].text

            # Comment.
            elements = tree.xpath('.//ram:IncludedNote/ram:Content', namespaces=tree.nsmap)
            if elements:
                invoice_form.comment = elements[0].text

            # Refund type.
            # There is two modes to handle refund in Factur-X:
            # a) type_code == 380 for invoice, type_code == 381 for refund, all positive amounts.
            # b) type_code == 380, negative amounts in case of refund.
            # To handle both, we consider the 'a' mode and switch to 'b' if a negative amount is encountered.
            elements = tree.xpath('.//rsm:ExchangedDocument/ram:TypeCode', namespaces=tree.nsmap)
            type_code = elements[0].text
            refund_sign = 1

            # Total amount.
            elements = tree.xpath('.//ram:GrandTotalAmount', namespaces=tree.nsmap)
            if elements:
                total_amount = float(elements[0].text)

                # Handle 'b' refund mode.
                if total_amount < 0 and type_code == '380':
                    refund_sign = -1

                # Currency.
                currency_str = elements[0].attrib['currencyID']
                currency = self.env.ref('base.%s' % currency_str.upper(), raise_if_not_found=False)
                if currency != self.env.user.company_id.currency_id and currency.active:
                    invoice_form.currency_id = currency

                # Store xml total amount.
                amount_total_import = total_amount * refund_sign

            # Date.
            elements = tree.xpath('//rsm:ExchangedDocument/ram:IssueDateTime/udt:DateTimeString', namespaces=tree.nsmap)
            if elements:
                date_str = elements[0].text
                date_obj = datetime.strptime(date_str, DEFAULT_FACTURX_DATE_FORMAT)
                invoice_form.date = date_obj.strftime(DEFAULT_SERVER_DATE_FORMAT)

            # Invoice lines.
            elements = tree.xpath('//ram:IncludedSupplyChainTradeLineItem', namespaces=tree.nsmap)
            if elements:
                for element in elements:
                    with invoice_form.invoice_line_ids.new() as invoice_line_form:

                        # Sequence.
                        line_elements = element.xpath('.//ram:AssociatedDocumentLineDocument/ram:LineID', namespaces=tree.nsmap)
                        if line_elements:
                            invoice_line_form.sequence = int(line_elements[0].text)

                        # Product.
                        line_elements = element.xpath('.//ram:SpecifiedTradeProduct/ram:Name', namespaces=tree.nsmap)
                        if line_elements:
                            invoice_line_form.name = line_elements[0].text
                        line_elements = element.xpath('.//ram:SpecifiedTradeProduct/ram:SellerAssignedID', namespaces=tree.nsmap)
                        if line_elements and line_elements[0].text:
                            product = self.env['product.product'].search([('default_code', '=', line_elements[0].text)])
                            if product:
                                invoice_line_form.product_id = product

                        # Price Unit.
                        line_elements = element.xpath('.//ram:GrossPriceProductTradePrice/ram:ChargeAmount', namespaces=tree.nsmap)
                        if line_elements:
                            invoice_line_form.price_unit = float(line_elements[0].text)
                        else:
                            line_elements = element.xpath('.//ram:NetPriceProductTradePrice/ram:ChargeAmount', namespaces=tree.nsmap)
                            if line_elements:
                                invoice_line_form.price_unit = float(line_elements[0].text)

                        # Quantity.
                        line_elements = element.xpath('.//ram:SpecifiedLineTradeDelivery/ram:BilledQuantity', namespaces=tree.nsmap)
                        if line_elements:
                            invoice_line_form.quantity = float(line_elements[0].text) * refund_sign

                        # Discount.
                        line_elements = element.xpath('.//ram:AppliedTradeAllowanceCharge/ram:CalculationPercent', namespaces=tree.nsmap)
                        if line_elements:
                            invoice_line_form.discount = float(line_elements[0].text)
            elif amount_total_import:
                # No lines in BASICWL.
                with invoice_form.invoice_line_ids.new() as invoice_line_form:
                    invoice_line_form.name = invoice_form.comment or '/'
                    invoice_line_form.quantity = 1
                    invoice_line_form.price_unit = amount_total_import

            # Refund.
            invoice_form.type = 'in_refund' if refund_sign == -1 else 'in_invoice'

        invoice = invoice_form.save()

        # Write the amount_total_import there because it's a readonly field and then, can't be written from the view.
        if amount_total_import:
            invoice.amount_total_import = amount_total_import

        return invoice

    @api.multi
    @api.returns('self', lambda value: value.id)
    def message_post(self, **kwargs):
        # OVERRIDE
        res = super(AccountInvoice, self).message_post(**kwargs)
        if len(self) == 1 and self.state == 'draft' and self.type in ('in_invoice', 'in_refund') and kwargs.get('attachments'):
            # Update the invoice values if a PDF containing a Factur-x xml file is uploaded.
            # /!\ Only manage attachments received by configuring a mail alias on Vendor Bills journal
            # ('attachments' key instead of 'attachment_ids').
            # This is not an ir.attachment record: see _Attachment namedtuple in mail.thread.
            for attachment_res in self.env['account.invoice.import']._attachment_to_xmls(kwargs.get('attachments')).values():
                xmls = attachment_res.get('xmls')

                if not xmls:
                    continue

                for filename, xml_tree in xmls:
                    if self._is_facturx_tree(xml_tree):
                        self._import_facturx_invoice(xml_tree)
                        break
        return res
