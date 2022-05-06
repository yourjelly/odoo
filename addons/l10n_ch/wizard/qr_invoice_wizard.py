# -*- coding: utf-8 -*-
from odoo.addons.l10n_ch.models.account_invoice import AccountMove
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

    nb_qr_inv = fields.Integer(default=0)
    nb_isr_inv = fields.Integer(default=0)
    nb_classic_inv = fields.Integer(default=0)
    qr_inv_text = fields.Text(compute='_compute_invoice_wizard_text_fields')
    isr_inv_text = fields.Text(compute='_compute_invoice_wizard_text_fields')
    classic_inv_text = fields.Text(compute='_compute_invoice_wizard_text_fields')

    def _compute_invoice_wizard_text_fields(self):
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

        invoices_ids = self._context.get('active_ids')
        sorted_invoices = AccountMove._l10n_ch_dispatch_invoices_to_print(self, invoices_ids)
        for wizard in self:
            wizard.qr_inv_text = determine_invoices_text(nb_inv=len(sorted_invoices['qr_inv_ids']), inv_format="QR")
            wizard.isr_inv_text = determine_invoices_text(nb_inv=len(sorted_invoices['isr_inv_ids']), inv_format="ISR")
            wizard.classic_inv_text = determine_invoices_text(nb_inv=len(sorted_invoices['classic_inv_ids']))

    @api.model
    def default_get(self, fields):
        if len(self.env.companies) > 1 or \
                any(i.company_id.id != self.env.companies[0].id
                    for i in self.env['account.move'].browse(self._context.get('active_ids'))):
            raise UserError(_("You can't print invoices for entries belonging to different companies."))
        if self.env.company.country_code != 'CH':
            raise UserError(_("This functionality is only available for Switzerland companies."))
        if not self._context.get('active_ids'):
            raise UserError(_("No invoice was found to be printed."))
        self._compute_invoice_wizard_text_fields()
        return super().default_get(fields)

    def print_all_invoices(self):
        '''
        Triggered by the Print All button
        '''
        all_invoices_ids = self.env.context.get('inv_ids')
        return self.env.ref('account.account_invoices').report_action(all_invoices_ids)

    def action_view_faulty_invoices(self):
        '''
        Open a list view of all the invoices that could not be printed in the QR nor the ISR format.
        '''
        # Prints the error stopping the invoice from being QR-printed in the invoice's chatter.
        invoices = self._context.get('inv_ids')
        sorted_invoices = AccountMove._l10n_ch_dispatch_invoices_to_print(self, invoices)
        classic_inv_ids = sorted_invoices['classic_inv_ids']
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
        if len(classic_inv_ids) == 1:
            action.update({
                'views': [(False, 'form')],
                'res_id': classic_inv_ids[0],
            })
        else:
            action.update({
                'view_mode': 'tree,form',
                'domain': [('id', 'in', classic_inv_ids)],
            })
        return action
