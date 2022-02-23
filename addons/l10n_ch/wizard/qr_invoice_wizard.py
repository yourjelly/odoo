# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import UserError


class QrInvoiceWizard(models.TransientModel):
    '''
    Wizard :
    When multiple invoices are selected to be printed in the QR-Iban format,
    this wizard will appear if one or more invoice(s) could not be QR-printed (wrong format...)
    The user will then be able to print the invoices (in the format available, priority : QR --> ISR --> normal)
     or to see a list of the non-QR/ISR invoices.
    The non-QR/ISR invoices will have a note logged in their chatter, detailing the reason of the failure.
    '''
    _name = 'l10n_ch.qr_invoice.wizard'
    _description = 'Handles problems occurring while creating multiple QR-invoices at once'

    nb_qr_inv = fields.Integer(default=lambda self: len(self._context.get('default_qr_inv_ids', [])))
    nb_isr_inv = fields.Integer(default=lambda self: len(self._context.get('default_isr_inv_ids', [])))
    nb_classic_inv = fields.Integer(default=lambda self: len(self._context.get('default_classic_inv_ids', [])))
    qr_inv_text = fields.Text(readonly=True)
    isr_inv_text = fields.Text(readonly=True)
    classic_inv_text = fields.Text(readonly=True)

    @api.model
    def default_get(self, fields):
        def determine_invoices_text(nb_inv, inv_format=None):
            '''
            Creates a sentence explaining nb_inv invoices could be printed in the inv_format format.
            '''
            if inv_format is None:
                inv_format = "classic"
            if nb_inv == 0:
                return _("No invoice could be printed in the %s format.", inv_format)
            if nb_inv == 1:
                return _("One invoice could be printed in the %s format.", inv_format)
            return str(nb_inv) + _(" invoices could be printed in the %s format.", inv_format)
        res = super().default_get(fields)
        # Create and format the text to be displayed in the wizard
        isr_len = len(self._context.get('default_isr_inv_ids', []))
        classic_len = len(self._context.get('default_classic_inv_ids', []))
        qr_len = len(self._context.get('default_qr_inv_ids', []))
        qr_inv_text = determine_invoices_text(nb_inv=qr_len, inv_format="QR")
        isr_inv_text = determine_invoices_text(nb_inv=isr_len, inv_format="ISR")
        classic_inv_text = determine_invoices_text(nb_inv=classic_len)
        res['qr_inv_text'] = qr_inv_text
        res['classic_inv_text'] = classic_inv_text
        res['isr_inv_text'] = isr_inv_text
        return res

    def print_all_invoices(self):
        '''
        Triggered by the Print All button
        '''
        all_invoices_ids = self.env.context.get('default_all_inv_ids')
        return self.env.ref('account.account_invoices').report_action(all_invoices_ids)

    def view_faulty_invoices(self):
        '''
        Open a list view of all the invoices that could not be printed in the QR nor the ISR format.
        '''
        # Prints the error stopping the invoice from being QR-printed in the invoice's chatter.
        classic_inv_ids = self.env.context.get('default_classic_inv_ids')
        if classic_inv_ids:
            for inv_id in classic_inv_ids:
                inv = self.env["account.move"].browse(inv_id)
                msg = False
                try:
                    # The error potentially raised in the following function helps create the wizard's message.
                    inv.partner_bank_id._eligible_for_qr_code('ch_qr', inv.partner_id, inv.currency_id,
                                                               raises_error=True)
                except UserError as e:
                    msg = e.name
                if msg:
                    inv.message_post(body=msg, message_type="comment")
        action = self.env['ir.actions.act_window']._for_xml_id('account.action_move_out_invoice_type')
        action['context'] = {'default_move_type': 'out_invoice', 'create': False}
        action['display_name'] = _('Invalid invoices')
        action.update({
            'view_mode': 'list,form',
            'domain': [('id', 'in', classic_inv_ids)],
        })
        return action
