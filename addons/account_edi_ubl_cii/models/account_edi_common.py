from markupsafe import Markup

from odoo import _, models, Command
from odoo.tools.misc import formatLang

from odoo.addons.base.models.res_bank import sanitize_account_number


class AccountEdiCommon(models.AbstractModel):
    _name = "account.edi.common"
    _inherit = "edi.mixin"
    _description = "Common functions for billing related EDI documents: generate the data, the constraints, etc"

    # -------------------------------------------------------------------------
    # COMMON CONSTRAINTS
    # -------------------------------------------------------------------------

    def _invoice_constraints_common(self, invoice):
        # check that there is a tax on each line
        for line in invoice.invoice_line_ids.filtered(lambda x: x.display_type not in ('line_note', 'line_section')):
            if not line.tax_ids:
                return {'tax_on_line': _("Each invoice line should have at least one tax.")}
        return {}

    # -------------------------------------------------------------------------
    # Import invoice
    # -------------------------------------------------------------------------

    def _import_invoice_ubl_cii(self, invoice, file_data, new=False):
        tree = file_data['xml_tree']

        # Not able to decode the move_type from the xml.
        move_type, qty_factor = self._get_import_document_amount_sign(tree)
        if not move_type:
            return

        # Check for inconsistent move_type.
        journal = invoice.journal_id
        if journal.type == 'sale':
            move_type = 'out_' + move_type
        elif journal.type == 'purchase':
            move_type = 'in_' + move_type
        else:
            return
        if not new and invoice.move_type != move_type:
            # with an email alias to create account_move, first the move is created (using alias_defaults, which
            # contains move_type = 'out_invoice') then the attachment is decoded, if it represents a credit note,
            # the move type needs to be changed to 'out_refund'
            types = {move_type, invoice.move_type}
            if types == {'out_invoice', 'out_refund'} or types == {'in_invoice', 'in_refund'}:
                invoice.move_type = move_type
            else:
                return

        # Update the invoice.
        invoice.move_type = move_type
        with invoice._get_edi_creation() as invoice:
            logs = self._import_fill_invoice(invoice, tree, qty_factor)

        if invoice:
            body = Markup("<strong>%s</strong>") % \
                _("Format used to import the invoice: %s",
                  self.env['ir.model']._get(self._name).name)

            if logs:
                body += Markup("<ul>%s</ul>") % \
                    Markup().join(Markup("<li>%s</li>") % l for l in logs)

            invoice.message_post(body=body)

        # For UBL, we should override the computed tax amount if it is less than 0.05 different of the one in the xml.
        # In order to support use case where the tax total is adapted for rounding purpose.
        # This has to be done after the first import in order to let Odoo compute the taxes before overriding if needed.
        with invoice._get_edi_creation() as invoice:
            self._correct_invoice_tax_amount(tree, invoice)

        attachments = self._import_attachments(invoice, tree)
        if attachments:
            invoice.with_context(no_new_invoice=True).message_post(attachment_ids=attachments.ids)

        return True

    def _import_attachments(self, invoice, tree):
        # Import the embedded PDF in the xml if some are found
        attachments = self.env['ir.attachment']
        additional_docs = tree.findall('./{*}AdditionalDocumentReference')
        for document in additional_docs:
            attachment_name = document.find('{*}ID')
            attachment_data = document.find('{*}Attachment/{*}EmbeddedDocumentBinaryObject')
            if attachment_name is not None \
                    and attachment_data is not None \
                    and attachment_data.attrib.get('mimeCode') == 'application/pdf':
                text = attachment_data.text
                # Normalize the name of the file : some e-fff emitters put the full path of the file
                # (Windows or Linux style) and/or the name of the xml instead of the pdf.
                # Get only the filename with a pdf extension.
                name = (attachment_name.text or 'invoice').split('\\')[-1].split('/')[-1].split('.')[0] + '.pdf'
                attachment = self.env['ir.attachment'].create({
                    'name': name,
                    'res_id': invoice.id,
                    'res_model': 'account.move',
                    'datas': text + '=' * (len(text) % 3),  # Fix incorrect padding
                    'type': 'binary',
                    'mimetype': 'application/pdf',
                })
                # Upon receiving an email (containing an xml) with a configured alias to create invoice, the xml is
                # set as the main_attachment. To be rendered in the form view, the pdf should be the main_attachment.
                if invoice.message_main_attachment_id and \
                        invoice.message_main_attachment_id.name.endswith('.xml') and \
                        'pdf' not in invoice.message_main_attachment_id.mimetype:
                    invoice._message_set_main_attachment_id(attachment, force=True, filter_xml=False)
                attachments |= attachment

        return attachments

    def _import_partner_bank(self, invoice, bank_details):
        """ Retrieve the bank account, if no matching bank account is found, create it """
        bank_details = map(sanitize_account_number, bank_details)
        partner = self.env.company.partner_id if invoice.is_inbound() else invoice.partner_id
        banks_to_create = []
        acc_number_partner_bank_dict = {
            bank.sanitized_acc_number: bank
            for bank in self.env['res.partner.bank'].search(
                [('company_id', 'in', [False, invoice.company_id.id]), ('acc_number', 'in', bank_details)]
            )
        }
        for account_number in bank_details:
            partner_bank = acc_number_partner_bank_dict.get(account_number, self.env['res.partner.bank'])
            if partner_bank.partner_id == partner:
                invoice.partner_bank_id = partner_bank
                return
            elif not partner_bank and account_number:
                banks_to_create.append({
                    'acc_number': account_number,
                    'partner_id': partner.id,
                })
        if banks_to_create:
            invoice.partner_bank_id = self.env['res.partner.bank'].create(banks_to_create)[0]

    def _import_prepaid_amount(self, invoice, tree, xpath, qty_factor):
        logs = []
        prepaid_amount = float(tree.findtext(xpath) or 0)
        if not invoice.currency_id.is_zero(prepaid_amount):
            amount = prepaid_amount * qty_factor
            formatted_amount = formatLang(self.env, amount, currency_obj=invoice.currency_id)
            logs.append(_("A payment of %s was detected.", formatted_amount))
        return logs

    def _import_invoice_lines(self, invoice, tree, xpath, qty_factor):
        logs = []
        lines_values = []
        for line_tree in tree.iterfind(xpath):
            line_values = self._retrieve_line_vals(line_tree, invoice.move_type, qty_factor)
            line_values['tax_ids'], tax_logs = self._retrieve_taxes(
                invoice, line_values, invoice.journal_id.type,
            )
            if not line_values['product_uom_id']:
                line_values.pop('product_uom_id')  # if no uom, pop it so it's inferred from the product_id
            lines_values.append(line_values)
            lines_values += self._retrieve_line_charges(
                invoice.company_id,
                line_values,
                line_values['tax_ids'],
            )
        return lines_values, logs + tax_logs

    def _get_allowance_charge_lines_vals(self, lines_vals):
        """ Overide of edi.mixin to get invoice line allowance charges values list.

        param list line_vals: List of allowance charges values.
        :return: List of invoice line values.
        """
        return [{
            'sequence': 0,  # be sure to put these lines above the 'real' invoice lines
            'name': name,
            'quantity': quantity,
            'price_unit': price_unit,
            'tax_ids': [Command.set(tax_ids)],
        } for name, quantity, price_unit, tax_ids in lines_vals]

    def _get_specific_tax(self, record, name, amount_type, amount, tax_type):
        tax = super()._get_specific_tax(record, name, amount_type, amount, tax_type)
        AccountMoveLine = self.env['account.move.line']
        if hasattr(AccountMoveLine, '_predict_specific_tax'):
            # company check is already done in the prediction query
            predicted_tax_id = AccountMoveLine._predict_specific_tax(
                record, name, record.partner_id, amount_type, amount, tax_type,
            )
            tax = self.env['account.tax'].browse(predicted_tax_id)
        return tax

    def _correct_invoice_tax_amount(self, tree, invoice):
        pass  # To be implemented by the format if needed
