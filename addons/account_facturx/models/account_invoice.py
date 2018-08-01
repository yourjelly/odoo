# -*- coding: utf-8 -*-

from odoo import api, models, fields, tools, _
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT, pdf
from odoo.osv import expression
from odoo.tests.common import Form

from datetime import datetime
from lxml import etree


DEFAULT_FACTURX_DATE_FORMAT = '%Y%m%d'


class AccountInvoice(models.Model):
    _inherit = 'account.invoice'
    _name = 'account.invoice'

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
        content = self.env.ref('account_facturx.account_invoice_facturx_export').render(template_values)
        return b"<?xml version='1.0' encoding='UTF-8'?>" + content

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
            elements = tree.xpath('//ram:SellerTradeParty/ram:SpecifiedTaxRegistration/ram:ID', namespaces=tree.nsmap)
            partner = elements and self.env['res.partner'].search([('vat', '=', elements[0].text)], limit=1)
            if not partner:
                elements = tree.xpath('//ram:SellerTradeParty/ram:Name', namespaces=tree.nsmap)
                partner = elements and self.env['res.partner'].search([('name', 'ilike', elements[0].text)], limit=1)
            if not partner:
                elements = tree.xpath('//ram:SellerTradeParty//ram:URIID[@schemeID=\'SMTP\']', namespaces=tree.nsmap)
                partner = elements and self.env['res.partner'].search([('email', '=', elements[0].text)], limit=1)
            if partner:
                invoice_form.partner_id = partner

            # Reference.
            elements = tree.xpath('//rsm:ExchangedDocument/ram:ID', namespaces=tree.nsmap)
            if elements:
                invoice_form.reference = elements[0].text

            # Comment.
            elements = tree.xpath('//ram:IncludedNote/ram:Content', namespaces=tree.nsmap)
            if elements:
                invoice_form.comment = elements[0].text

            # Refund type.
            # There is two modes to handle refund in Factur-X:
            # a) type_code == 380 for invoice, type_code == 381 for refund, all positive amounts.
            # b) type_code == 380, negative amounts in case of refund.
            # To handle both, we consider the 'a' mode and switch to 'b' if a negative amount is encountered.
            elements = tree.xpath('//rsm:ExchangedDocument/ram:TypeCode', namespaces=tree.nsmap)
            type_code = elements[0].text
            refund_sign = 1

            # Total amount.
            elements = tree.xpath('//ram:GrandTotalAmount', namespaces=tree.nsmap)
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

        return invoice_form.save()

    @api.multi
    @api.returns('self', lambda value: value.id)
    def message_post(self, **kwargs):
        # OVERRIDE
        res = super(AccountInvoice, self).message_post(**kwargs)
        if len(self) == 1 and self.state == 'draft' and self.type in ('in_invoice', 'in_refund'):
            for mail_attachment in kwargs.get('attachments'):
                # Check if the attachment is a pdf.
                if not mail_attachment.fname.endswith('.pdf'):
                    continue

                try:
                    reader = pdf.OdooPdfFileReader(mail_attachment['content'])
                except:
                    # Malformed PDF.
                    continue

                # Search for Factur-x embedded file.
                for embedded_file in reader.getAttachments():
                    if embedded_file['filename'] == 'factur-x.xml':
                        try:
                            tree = etree.fromstring(embedded_file['content'])
                        except:
                            continue

                        self._import_facturx_invoice(tree)
                        return res
        return res
