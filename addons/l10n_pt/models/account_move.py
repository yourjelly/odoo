from odoo import models, fields, _, api
from odoo.exceptions import RedirectWarning, UserError
from odoo.tools import float_is_zero, format_date, float_repr
import stdnum.pt.nif
import re


class AccountMove(models.Model):
    _inherit = "account.move"

    l10n_pt_qr_code_str = fields.Char(string='Portuguese QR Code', compute='_compute_l10n_pt_qr_code_str', store=True)
    l10n_pt_inalterable_hash_short = fields.Char(string='Short verison of the Portuguese hash', compute='_compute_l10n_pt_inalterable_hash_short')
    l10n_pt_show_future_date_warning = fields.Boolean(compute='_compute_l10n_pt_show_future_date_warning')

    @api.depends('inalterable_hash')
    def _compute_l10n_pt_inalterable_hash_short(self):
        for move in self:
            if move.inalterable_hash:
                hash_str = move.inalterable_hash
                move.l10n_pt_inalterable_hash_short = hash_str[0] + hash_str[10] + hash_str[20] + hash_str[30]
            else:
                move.l10n_pt_inalterable_hash_short = False

    @api.depends('state', 'invoice_date', 'company_id.account_fiscal_country_id.code')
    def _compute_l10n_pt_show_future_date_warning(self):
        for move in self:
            move.l10n_pt_show_future_date_warning = (
                move.company_id.account_fiscal_country_id.code == 'PT'
                and move.state == 'draft'
                and move.invoice_date
                and move.invoice_date > fields.Date.today()
            )

    def _compute_l10n_pt_qr_code_str(self):
        """ Generate the informational QR code for Portugal invoicing.
        E.g.: A:509445535*B:123456823*C:BE*D:FT*E:N*F:20220103*G:FT 01P2022/1*H:0*I1:PT*I7:325.20*I8:74.80*N:74.80*O:400.00*P:0.00*Q:P0FE*R:2230
        """
        def format_amount(account_move, amount):
            """
            Convert amount to EUR based on the rate of a given account_move's date
            Format amount to 2 decimals as per SAF-T (PT) requirements
            """
            amount_eur = account_move.currency_id._convert(amount, self.env.ref('base.EUR'), account_move.company_id, account_move.date)
            return float_repr(amount_eur, 2)

        def get_details_by_tax_category(account_move):
            """Returns the base and value tax for each PT tax category (Normal, Intermediate, Reduced, Exempt)"""
            res = {}
            amount_by_group = account_move.tax_totals['groups_by_subtotal']['Untaxed Amount']
            for group in amount_by_group:
                tax_group = self.env['account.tax.group'].browse(group['tax_group_id'])
                if (
                    not tax_group.l10n_pt_tax_region  # I.e. tax is valid in all regions (PT, PT-AC, PT-MA)
                    or (
                        tax_group.l10n_pt_tax_region
                        and tax_group.l10n_pt_tax_region == account_move.company_id.l10n_pt_region_code
                    )
                ):
                    res[tax_group.l10n_pt_tax_category] = {
                        'base': format_amount(account_move, group['tax_group_base_amount']),
                        'vat': format_amount(account_move, group['tax_group_amount']),
                    }
            return res

        INVOICE_TYPE_MAP = {
            "out_invoice": "FT",
            "out_refund": "NC",
            "out_receipt": "FR",
        }

        self.filtered(lambda m: not m.inalterable_hash).inalterable_hash = "FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE"  # TODO: Remove this line when the hash is implemented
        for move in self.filtered(lambda m: (
            m.company_id.account_fiscal_country_id.code == "PT"
            and m.move_type in INVOICE_TYPE_MAP
            and not m.l10n_pt_qr_code_str  # Skip if already computed
        )):
            company_vat_ok = move.company_id.vat and stdnum.pt.nif.is_valid(move.company_id.vat)
            partner_country_ok = move.partner_id.country_id
            hash_ok = move.inalterable_hash

            if not company_vat_ok or not partner_country_ok or not hash_ok:
                error_msg = _("Some fields required for the generation of the document are missing or invalid. Please verify them:\n")
                error_msg += _('- The `VAT` of your company should be defined and match the following format: PT123456789\n') if not company_vat_ok else ""
                error_msg += _('- The `country of the customer should be defined\n') if not partner_country_ok else ""
                error_msg += _('- The document is not securely signed (perhaps it is still in draft ?)') if not hash_ok else ""
                raise UserError(error_msg)

            company_vat = re.sub(r'\D', '', move.company_id.vat)
            partner_vat = re.sub(r'\D', '', move.partner_id.vat or '999999990')
            details_by_tax_group = get_details_by_tax_category(move)
            tax_letter = 'I'
            if move.company_id.l10n_pt_region_code == 'PT-AC':
                tax_letter = 'J'
            elif move.company_id.l10n_pt_region_code == 'PT-MA':
                tax_letter = 'K'

            qr_code_str = ""
            qr_code_str += f"A:{company_vat}*"
            qr_code_str += f"B:{partner_vat}*"
            qr_code_str += f"C:{move.partner_id.country_id.code}*"
            qr_code_str += f"D:{INVOICE_TYPE_MAP[move.move_type]}*"
            qr_code_str += "E:N*"
            qr_code_str += f"F:{format_date(self.env, move.date, date_format='yyyyMMdd')}*"
            qr_code_str += "G:TODO*"  # TODO: l10n_pt_doc_number
            qr_code_str += "H:0*"  # TODO: ATCUD
            qr_code_str += f"{tax_letter}1:{move.company_id.l10n_pt_region_code}*"
            if details_by_tax_group.get('E'):
                qr_code_str += f"{tax_letter}2:{details_by_tax_group.get('E')['base']}*"
            for i, tax_category in enumerate(('R', 'I', 'N')):
                if details_by_tax_group.get(tax_category):
                    qr_code_str += f"{tax_letter}{i*2+3}:{details_by_tax_group.get(tax_category)['base']}*"
                    qr_code_str += f"{tax_letter}{i*2+4}:{details_by_tax_group.get(tax_category)['vat']}*"
            qr_code_str += f"N:{format_amount(move, move.tax_totals['amount_total'] - move.tax_totals['amount_untaxed'])}*"
            qr_code_str += f"O:{format_amount(move, move.tax_totals['amount_total'])}*"
            qr_code_str += "Q:TODO*"  # TODO: l10n_pt_inalterable_hash_short
            qr_code_str += "R:0000"  # TODO: Fill with Certifiate number provided by the Tax Authority
            move.l10n_pt_qr_code_str = qr_code_str

    def _l10n_pt_get_vat_exemptions_reasons(self):
        self.ensure_one()
        return sorted(set(
            self.invoice_line_ids.tax_ids
                .filtered(lambda tax: tax.l10n_pt_tax_exemption_reason)
                .mapped(lambda tax: dict(tax._fields['l10n_pt_tax_exemption_reason'].selection).get(tax.l10n_pt_tax_exemption_reason))
        ))

    def _l10n_pt_check_invoice_date(self):
        """
        "When the document issuing date is later than the current date, or superior than the date on the system,
        no other document may be issued with the current or previous date within the same series" - Portuguese Tax Authority
        """
        self.ensure_one()
        if not self.invoice_date:
            return
        self._cr.execute("""
            SELECT MAX(invoice_date)
              FROM account_move
             WHERE journal_id = %s
               AND move_type = %s
               AND state = 'posted'
        """, (self.journal_id.id, self.move_type))
        max_invoice_date = self._cr.fetchone()
        if max_invoice_date and max_invoice_date[0] and max_invoice_date[0] > fields.Date.today() and self.invoice_date < max_invoice_date[0]:
            raise UserError(_("You cannot create an invoice with a date anterior to the last invoice issued within the same journal."))

    @api.model
    def _deduce_sequence_number_reset(self, name):
        if self.company_id.account_fiscal_country_id.code != "PT":
            return super()._deduce_sequence_number_reset(name)
        return "never"

    def _get_starting_sequence(self):
        # EXTENDS account sequence.mixin
        if self.company_id.account_fiscal_country_id.code != "PT":
            return super()._get_starting_sequence()
        self.ensure_one()
        starting_sequence = f"{self.journal_id.code}/0"
        if self.journal_id.refund_sequence and self.move_type in ('out_refund', 'in_refund'):
            starting_sequence = "R" + starting_sequence
        elif self.journal_id.payment_sequence and (self.payment_id or self._context.get('is_payment')):
            starting_sequence = "P" + starting_sequence
        return starting_sequence

    def action_reverse(self):
        for move in self.filtered(lambda m: m.company_id.account_fiscal_country_id.code == "PT"):
            if move.payment_state == 'reversed':
                raise UserError(_("You cannot reverse an invoice that has already been fully reversed."))
        return super().action_reverse()

    def action_post(self):
        for move in self.filtered(lambda m: m.company_id.account_fiscal_country_id.code == 'PT').sorted('invoice_date'):
            move._l10n_pt_check_invoice_date()
            for line in move.invoice_line_ids:
                line._l10n_pt_check_validity()
            move._compute_l10n_pt_qr_code_str()
        return super().action_post()


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    def _l10n_pt_check_validity(self):
        for line in self:
            # Check if the discount is valid
            if line.discount > 100 or line.discount < 0:
                raise UserError(_("Discounts must be between 0% and 100%."))
            
            # Check if the taxes are valid
            for tax in line.tax_ids:
                if float_is_zero(tax.amount, precision_digits=2) and not tax.l10n_pt_tax_exemption_reason:
                    error_msg = _("According to Portuguese law, you must provide a tax exemption reason for the tax '%s'", tax.name)
                    error_action = {
                        'type': 'ir.actions.act_window',
                        'view_mode': 'form',
                        'res_model': 'account.tax',
                        'res_id': tax.id,
                        'views': [[False, 'form']],
                        'target': 'new',
                    }
                    raise RedirectWarning(error_msg, error_action, _("Configure the tax '%s'", tax.name))
