# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields, _
from odoo.tests.common import Form
from odoo.exceptions import UserError
from odoo.tools import float_repr
from .sdl_coop_request import SdlCoopRequest

import re
from datetime import date, datetime
import logging
import base64


_logger = logging.getLogger(__name__)

DEFAULT_FACTUR_ITALIAN_DATE_FORMAT = '%Y-%m-%d'

# FatturaPA documentation : https://www.fatturapa.gov.it/en/norme-e-regole/
# There are two important files :
# - FatturaPA documentation (v1.3.1)
# - Exchange System (v1.8.1)

class AccountEdiFormat(models.Model):
    _inherit = 'account.edi.format'

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    @api.model
    def _l10n_it_edi_generate_electronic_invoice_filename(self, invoice):
        '''Returns a name conform to the Fattura pa Specifications : 
           See ES documentation 2.2
        '''
        a = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        n = self.id
        progressive_number = ""
        while n:
            (n,m) = divmod(n,len(a))
            progressive_number = a[m] + progressive_number

        return '%(country_code)s%(codice)s_%(progressive_number)s.xml' % {
            'country_code': invoice.company_id.country_id.code,
            'codice': invoice.company_id.l10n_it_codice_fiscale,
            'progressive_number': progressive_number.zfill(5),
            }

    def _l10n_it_edi_check_invoice_configuration(self, invoice):
        errors = []
        seller = invoice.company_id
        buyer = invoice.commercial_partner_id

        # <1.1.1.1>
        if not seller.country_id:
            errors.append(_("%s must have a country") % (seller.display_name))

        # <1.1.1.2>
        if not seller.vat:
            errors.append(_("%s must have a VAT number") % (seller.display_name))
        elif len(seller.vat) > 30:
            errors.append(_("The maximum length for VAT number is 30. %s have a VAT number too long: %s.") % (seller.display_name, seller.vat))

        # <1.2.1.2>
        if not seller.l10n_it_codice_fiscale:
            errors.append(_("%s must have a codice fiscale number") % (seller.display_name))

        # <1.2.1.8>
        if not seller.l10n_it_tax_system:
            errors.append(_("The seller's company must have a tax system."))

        # <1.2.2>
        if not seller.street and not seller.street2:
            errors.append(_("%s must have a street.") % (seller.display_name))
        if not seller.zip:
            errors.append(_("%s must have a post code.") % (seller.display_name))
        if len(seller.zip) != 5 and seller.country_id.code == 'IT':
            errors.append(_("%s must have a post code of length 5.") % (seller.display_name))
        if not seller.city:
            errors.append(_("%s must have a city.") % (seller.display_name))
        if not seller.country_id:
            errors.append(_("%s must have a country.") % (seller.display_name))

        if seller.l10n_it_has_tax_representative and not seller.l10n_it_tax_representative_partner_id.vat:
            errors.append(_("Tax representative partner %s of %s must have a tax number.") % (seller.l10n_it_tax_representative_partner_id.display_name, seller.display_name))

        # <1.4.1>
        if not buyer.vat and not buyer.l10n_it_codice_fiscale and buyer.country_id.code == 'IT':
            errors.append(_("The buyer, %s, or his company must have either a VAT number either a tax code (Codice Fiscale).") % (buyer.display_name))

        # <1.4.2>
        if not buyer.street and not buyer.street2:
            errors.append(_("%s must have a street.") % (buyer.display_name))
        if not buyer.zip:
            errors.append(_("%s must have a post code.") % (buyer.display_name))
        if len(buyer.zip) != 5 and buyer.country_id.code == 'IT':
            errors.append(_("%s must have a post code of length 5.") % (buyer.display_name))
        if not buyer.city:
            errors.append(_("%s must have a city.") % (buyer.display_name))
        if not buyer.country_id:
            errors.append(_("%s must have a country.") % (buyer.display_name))

        # <2.2.1>
        if any(len(l.tax_ids) != 1 for l in invoice.invoice_line_ids):
            errors.append(_("You must select one and only one tax by line."))

        for tax_line in invoice.line_ids.filtered(lambda line: line.tax_line_id):
            if not tax_line.tax_line_id.l10n_it_exoneration and tax_line.tax_line_id.amount == 0:
                errors.append(_("%s has an amount of 0.0, you must indicate the kind of exoneration.", tax_line.name))

        return errors

    # -------------------------------------------------------------------------
    # EXPORT
    # -------------------------------------------------------------------------

    def _l10n_it_edi_generate_xml(self, invoice):
        ''' Create the xml file content.
        :return: The XML content as str.
        '''

        def format_date(dt):
            # Format the date in the italian standard.
            dt = dt or datetime.now()
            return dt.strftime(DEFAULT_FACTUR_ITALIAN_DATE_FORMAT)

        def format_monetary(number, currency):
            # Format the monetary values to avoid trailing decimals (e.g. 90.85000000000001).
            return float_repr(number, min(2, currency.decimal_places))

        def format_numbers(number):
            #format number to str with between 2 and 8 decimals (event if it's .00)
            number_splited = str(number).split('.')
            if len(number_splited) == 1:
                return "%.02f" % number

            cents = number_splited[1]
            if len(cents) > 8:
                return "%.08f" % number
            return float_repr(number, max(2, len(cents)))

        def format_phone(number):
            if not number:
                return False
            number = number.replace(' ', '').replace('/', '').replace('.', '')
            if len(number) > 4 and len(number) < 13:
                return number
            return False

        def get_vat_number(vat):
            return vat[2:].replace(' ', '')

        def get_vat_country(vat):
            return vat[:2].upper()

        formato_trasmissione = "FPR12"
        if len(invoice.commercial_partner_id.l10n_it_pa_index or '1') == 6:
            formato_trasmissione = "FPA12"

        if invoice.move_type == 'out_invoice':
            document_type = 'TD01'
        elif invoice.move_type == 'out_refund':
            document_type = 'TD04'
        else:
            document_type = 'TD0X'

        pdf = self.env.ref('account.account_invoices')._render_qweb_pdf(invoice.id)[0]
        pdf = base64.b64encode(pdf)
        pdf_name = re.sub(r'\W+', '', invoice.name) + '.pdf'

        # Create file content.
        template_values = {
            'record': invoice,
            'format_date': format_date,
            'format_monetary': format_monetary,
            'format_numbers': format_numbers,
            'format_phone': format_phone,
            'get_vat_number': get_vat_number,
            'get_vat_country': get_vat_country,
            'abs': abs,
            'formato_trasmissione': formato_trasmissione,
            'document_type': document_type,
            'pdf': pdf,
            'pdf_name': pdf_name,
        }
        content = self.env.ref('l10n_it_edi.account_invoice_it_FatturaPA_export')._render(template_values)
        return b"<?xml version='1.0' encoding='UTF-8'?>" + content

    # -------------------------------------------------------------------------
    # Import
    # -------------------------------------------------------------------------

    def _import_fattura_pa(self, tree, invoice):
        """ Decodes a fattura_pa invoice into an invoice.

        :param tree:    the fattura_pa tree to decode.
        :param invoice: the invoice to update or an empty recordset.
        :returns:       the invoice where the fattura_pa data was imported.
        """
        invoices = self.env['account.move']

        # possible to have multiple invoices in the case of an invoice batch, the batch itself is repeated for every invoice of the batch
        for body_tree in tree.xpath('//FatturaElettronicaBody'):
            invoice_type = self._find_value('//DatiGeneraliDocumento/TipoDocumento', body_tree)
            if invoice_type == 'TD01':
                self_ctx = invoice.with_context(default_move_type='in_invoice')
            elif invoice_type == 'TD04':
                self_ctx = invoice.with_context(default_move_type='in_refund')
            else:
                _logger.info('Document type not managed: %s.', invoice_type)

            # type must be present in the context to get the right behavior of the _default_journal method (account.move).
            # journal_id must be present in the context to get the right behavior of the _default_account method (account.move.line).

            vat = self._find_value('//CessionarioCommittente//IdCodice', body_tree)
            company = self._retrieve_company(vat=vat)
            if not company:
                codice = self._find_value('//CessionarioCommittente//CodiceFiscale', body_tree)
                company = codice and self.env['res.company'].search([('l10n_it_codice_fiscale', 'ilike', body_tree)], limit=1)

            if company:
                self_ctx = self_ctx.with_context(company_id=company.id)
            else:
                company = self.env.company
                _logger.info('Company not found. The user\'s company is set by default.')

            if not self.env.is_superuser() and self.env.company != company:
                raise UserError(_("You can only import invoice concern your current company: %s", self.env.company.display_name))

            with Form(invoice) as invoice_form:
                # Partner. <1.2>
                partner_codice = self._find_value('//CedentePrestatore//CodiceFiscale', body_tree)
                invoice_form.partner_id = self._retrieve_partner(
                    mail=self._find_value('//DatiTrasmissione//Email', body_tree),
                    vat=self._find_value('//CedentePrestatore//IdCodice', body_tree),
                    others=[[('l10n_it_codice_fiscale', '=', partner_codice)]] if partner_codice else None
                )

                # Numbering attributed by the transmitter. <1.1.2>
                elements = body_tree.xpath('//ProgressivoInvio')
                if elements:
                    invoice_form.payment_reference = self._find_value('//ProgressivoInvio', body_tree)

                elements = body_tree.xpath('.//DatiGeneraliDocumento//Numero')
                if elements:
                    invoice_form.ref = elements[0].text

                # Currency. <2.1.1.2>
                elements = body_tree.xpath('.//DatiGeneraliDocumento/Divisa')
                if elements:
                    invoice_form.currency_id = self._retrieve_currency(elements[0].text)

                # Date. <2.1.1.3>
                elements = body_tree.xpath('.//DatiGeneraliDocumento/Data')
                if elements:
                    date_str = elements[0].text
                    date_obj = datetime.strptime(date_str, DEFAULT_FACTUR_ITALIAN_DATE_FORMAT)
                    invoice_form.invoice_date = date_obj.strftime(DEFAULT_FACTUR_ITALIAN_DATE_FORMAT)

                #  Dati Bollo. <2.1.1.6>
                elements = body_tree.xpath('.//DatiGeneraliDocumento/DatiBollo/ImportoBollo')
                if elements:
                    invoice_form.l10n_it_stamp_duty = float(elements[0].text)

                # List of all amount discount (will be add after all article to avoid to have a negative sum)
                discount_list = []
                percentage_global_discount = 1.0

                # Global discount. <2.1.1.8>
                discount_elements = body_tree.xpath('.//DatiGeneraliDocumento/ScontoMaggiorazione')
                total_discount_amount = 0.0
                if discount_elements:
                    for discount_element in discount_elements:
                        discount_line = discount_element.xpath('.//Tipo')
                        discount_sign = -1
                        if discount_line and discount_line[0].text == 'SC':
                            discount_sign = 1
                        discount_percentage = discount_element.xpath('.//Percentuale')
                        if discount_percentage and discount_percentage[0].text:
                            percentage_global_discount *= 1 - float(discount_percentage[0].text)/100 * discount_sign

                        discount_amount_text = discount_element.xpath('.//Importo')
                        if discount_amount_text and discount_amount_text[0].text:
                            discount_amount = float(discount_amount_text[0].text) * discount_sign * -1
                            discount = {}
                            discount["seq"] = 0

                            if discount_amount < 0:
                                discount["name"] = _('GLOBAL DISCOUNT')
                            else:
                                discount["name"] = _('GLOBAL EXTRA CHARGE')
                            discount["amount"] = discount_amount
                            discount["tax"] = []
                            discount_list.append(discount)

                # Comment. <2.1.1.11>
                elements = body_tree.xpath('.//DatiGeneraliDocumento//Causale')
                for element in elements:
                    invoice_form.narration = '%s%s\n' % (invoice_form.narration or '', element.text)

                # Due date. <2.4.2.5>
                elements = body_tree.xpath('.//DatiPagamento/DettaglioPagamento/DataScadenzaPagamento')
                if elements:
                    date_str = elements[0].text
                    date_obj = datetime.strptime(date_str, DEFAULT_FACTUR_ITALIAN_DATE_FORMAT)
                    invoice_form.invoice_date_due = fields.Date.to_string(date_obj)

                # Invoice lines. <2.2.1>
                elements = body_tree.xpath('.//DettaglioLinee')
                for element in elements:
                    with invoice_form.invoice_line_ids.new() as invoice_line_form:

                        # Sequence.
                        line_elements = element.xpath('.//NumeroLinea')
                        if line_elements:
                            invoice_line_form.sequence = int(line_elements[0].text) * 2

                        # Product.
                        name = self._find_value('.//Descrizione', element)
                        if name:
                            invoice_line_form.name = name
                        ean = self._find_value('.//CodiceArticolo/CodiceTipo[text()="EAN"]/../CodiceValore', element)
                        product = self._retrieve_product(barcode=ean)
                        if not product:
                            for element_code in element.xpath('.//CodiceArticolo/CodiceTipo[not(text()="EAN")]/../CodiceValore'):
                                code = element_code.text
                                product = self._retrieve_product(default_code=code)
                                if not product and invoice_form.partner_id:
                                    product_supplier = self.env['product.supplierinfo'].search([('name', '=', invoice_form.partner_id.id), ('product_code', '=', code)])
                                    if product_supplier and product_supplier.product_id:
                                        product = product_supplier.product_id
                                if product:
                                    break
                        if product:
                            invoice_line_form.product_id = product

                        # Price Unit.
                        line_elements = element.xpath('.//PrezzoUnitario')
                        if line_elements:
                            invoice_line_form.price_unit = float(line_elements[0].text)

                        # Quantity.
                        line_elements = element.xpath('.//Quantita')
                        invoice_line_form.quantity = float(line_elements[0].text) if line_elements else 1

                        # Taxes
                        invoice_line_form.tax_ids.clear()
                        natura = element.xpath('.//Natura')
                        tax = self._retrieve_tax(
                            amount=self._find_value('.//AliquotaIVA', element),
                            type_tax_use='purchase',
                            others=[[('l10n_it_exoneration', '=', natura[0].text)]] if natura else []
                        )

                        if tax:
                            invoice_line_form.tax_ids.add(tax)

                        # Discount in cascade mode.
                        # if 3 discounts : -10% -50€ -20%
                        # the result must be : (((price -10%)-50€) -20%)
                        # Generic form : (((price -P1%)-A1€) -P2%)
                        # It will be split in two parts: fix amount and pourcent amount
                        # example: (((((price - A1€) -P2%) -A3€) -A4€) -P5€)
                        # pourcent: 1-(1-P2)*(1-P5)
                        # fix amount: A1*(1-P2)*(1-P5)+A3*(1-P5)+A4*(1-P5) (we must take account of all
                        # percentage present after the fix amount)
                        line_elements = element.xpath('.//ScontoMaggiorazione')
                        total_discount_amount = 0.0
                        total_discount_percentage = percentage_global_discount
                        if line_elements:
                            for line_element in line_elements:
                                discount_line = line_element.xpath('.//Tipo')
                                discount_sign = -1
                                if discount_line and discount_line[0].text == 'SC':
                                    discount_sign = 1
                                discount_percentage = line_element.xpath('.//Percentuale')
                                if discount_percentage and discount_percentage[0].text:
                                    pourcentage_actual = 1 - float(discount_percentage[0].text)/100 * discount_sign
                                    total_discount_percentage *= pourcentage_actual
                                    total_discount_amount *= pourcentage_actual

                                discount_amount = line_element.xpath('.//Importo')
                                if discount_amount and discount_amount[0].text:
                                    total_discount_amount += float(discount_amount[0].text) * discount_sign * -1

                            # Save amount discount.
                            if total_discount_amount != 0:
                                discount = {}
                                discount["seq"] = invoice_line_form.sequence + 1

                                if total_discount_amount < 0:
                                    discount["name"] = _('DISCOUNT: %s', invoice_line_form.name)
                                else:
                                    discount["name"] = _('EXTRA CHARGE: %s', invoice_line_form.name)
                                discount["amount"] = total_discount_amount
                                discount["tax"] = []
                                for tax in invoice_line_form.tax_ids:
                                    discount["tax"].append(tax)
                                discount_list.append(discount)
                        invoice_line_form.discount = (1 - total_discount_percentage) * 100

                # Apply amount discount.
                for discount in discount_list:
                    with invoice_form.invoice_line_ids.new() as invoice_line_form_discount:
                        invoice_line_form_discount.tax_ids.clear()
                        invoice_line_form_discount.sequence = discount["seq"]
                        invoice_line_form_discount.name = discount["name"]
                        invoice_line_form_discount.price_unit = discount["amount"]

            invoice = invoice_form.save()
            invoice.l10n_it_send_state = "other"

            # Attachment
            elements = body_tree.xpath('.//Allegati')
            if elements:
                for element in elements:
                    name_attachment = element.xpath('.//NomeAttachment')[0].text
                    attachment_64 = str.encode(element.xpath('.//Attachment')[0].text)
                    attachment_64 = self.env['ir.attachment'].create({
                        'name': name_attachment,
                        'datas': attachment_64,
                        'type': 'binary',
                    })

                    # default_res_id is had to context to avoid facturx to import his content
                    # no_new_invoice to prevent from looping on the message_post that would create a new invoice without it
                    invoice.with_context(no_new_invoice=True, default_res_id=invoice.id).message_post(
                        body=(_("Attachment from XML")),
                        attachment_ids=[attachment_64.id]
                    )

            invoices += invoice
            invoice = self.env['account.move']  # next invoice
        return invoices

    # -------------------------------------------------------------------------
    # BUSINESS FLOW: EDI
    # -------------------------------------------------------------------------

    def _check_filename_is_fattura_pa(self, filename):
        return re.search("([A-Z]{2}[A-Za-z0-9]{2,28}_[A-Za-z0-9]{0,5}.(xml.p7m|xml))", filename)

    def _is_fattura_pa(self, filename, tree):
        return self.code == 'fattura_pa' and self._check_filename_is_fattura_pa(filename)

    def _create_invoice_from_xml_tree(self, filename, tree):
        self.ensure_one()
        if self._is_fattura_pa(filename, tree):
            return self._import_fattura_pa(tree, self.env['account.move'])
        return super()._create_invoice_from_xml_tree(filename, tree)

    def _update_invoice_from_xml_tree(self, filename, tree, invoice):
        self.ensure_one()
        if self._is_fattura_pa(filename, tree):
            if len(tree.xpath('//FatturaElettronicaBody')) > 1:
                invoice.message_post(body='The attachment contains multiple invoices, this invoice was not updated from it.',
                                     message_type='comment',
                                     subtype_xmlid='mail.mt_note',
                                     author_id=self.env.ref('base.partner_root').id)
            else:
                return self._import_fattura_pa(tree, invoice)
        return super()._update_invoice_from_xml_tree(filename, tree, invoice)

    def _needs_web_services(self):
        # OVERRIDE
        return False  # TODO self.code == 'fattura_pa' or super()._needs_web_services()

    def _is_compatible_with_journal(self, journal):
        # OVERRIDE
        self.ensure_one()
        if self.code != 'fattura_pa':
            return super()._is_compatible_with_journal(journal)
        return journal.type == 'sale' and journal.country_code == 'IT'

    def _is_required_for_invoice(self, invoice):
        # OVERRIDE
        self.ensure_one()
        if self.code != 'fattura_pa':
            return super()._is_required_for_invoice(invoice)

        # Determine on which invoices the FatturaPA must be generated.
        print('checking', invoice.l10n_it_send_state, invoice.is_sale_document(), invoice.country_code)
        return invoice.is_sale_document() and invoice.l10n_it_send_state not in ['sent', 'delivered', 'delivered_accepted'] and invoice.country_code == 'IT'

    def _post_invoice_edi(self, invoices, test_mode=False):
        # OVERRIDE
        self.ensure_one()
        edi_result = super()._post_invoice_edi(invoices, test_mode=test_mode)
        if self.code != 'fattura_pa':
            return edi_result

        invoice = invoices  # no batching ensure that we only have one invoice
        invoice.l10n_it_send_state = 'other'
        errors = self._l10n_it_edi_check_invoice_configuration(invoice)
        if errors:
            return {invoice: {'error': self._format_error_message(_("Invalid configuration:"), errors)}}

        xml = self._l10n_it_edi_generate_xml(invoice)
        attachment = self.env['ir.attachment'].create({
            'name': self._l10n_it_edi_generate_electronic_invoice_filename(invoice),
            'res_id': invoice.id,
            'res_model': invoice._name,
            'datas': base64.encodebytes(xml),
            'description': _('Italian invoice: %s', invoice.move_type),
            'type': 'binary',
        })
        res = {'attachment': attachment}

        if len(invoice.commercial_partner_id.l10n_it_pa_index or '') == 6:
            invoice.message_post(
                body=(_("Invoices for PA are not managed by Odoo, you can download the document and send it on your own."))
            )
        else:
            invoice.l10n_it_send_state = 'to_send'
            invoice.send_pec_mail(attachment)
            sdl = SdlCoopRequest()
            sdl.upload(attachment.name, xml)
        return {invoice: res}
