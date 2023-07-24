from odoo import api, fields, models
from odoo.tools.float_utils import float_repr, float_round


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_pe_edi_operation_type = fields.Selection(
        selection=[
            ('0101', '[0101] Internal sale'),
            ('0112', '[0112] Internal Sale - Sustains Natural Person Deductible Expenses'),
            ('0113', '[0113] Internal Sale-NRUS'),
            ('0200', '[0200] Export of Goods'),
            ('0201', '[0201] Exportation of Services - Provision of services performed entirely in the country'),
            ('0202', '[0202] Exportation of Services - Provision of non-domiciled lodging services'),
            ('0203', '[0203] Exports of Services - Transport of shipping companies'),
            ('0204', '[0204] Exportation of Services - Services to foreign-flagged ships and aircraft'),
            ('0205', '[0205] Exportation of Services - Services that make up a Tourist Package'),
            ('0206', '[0206] Exports of Services - Complementary services to freight transport'),
            ('0207', '[0207] Exportation of Services - Supply of electric power in favor of subjects domiciled in ZED'),
            ('0208', '[0208] Exportation of Services - Provision of services partially carried out abroad'),
            ('0301', '[0301] Operations with air waybill (issued in the national scope)'),
            ('0302', '[0302] Passenger rail transport operations'), ('0303', '[0303] Oil royalty Pay Operations'),
            ('0401', '[0401] Non-domiciled sales that do not qualify as an export'),
            ('1001', '[1001] Operation Subject to Detraction'),
            ('1002', '[1002] Operation Subject to Detraction - Hydrobiological Resources'),
            ('1003', '[1003] Operation Subject to Drawdown - Passenger Transport Services'),
            ('1004', '[1004] Operation Subject to Drawdown - Cargo Transportation Services'),
            ('2001', '[2001] Operation Subject to Perception')
        ],
        string="Operation Type (PE)",
        store=True, readonly=False,
        compute='_compute_l10n_pe_edi_operation_type',
        help="Defines the operation type, all the options can be used for all the document types, except "
             "'[0113] Internal Sale-NRUS' that is for document type 'Boleta' and '[0112] Internal Sale - Sustains "
             "Natural Person Deductible Expenses' exclusive for document type 'Factura'"
             "It can't be changed after validation. This is an optional feature added to avoid a warning. Catalog No. 51")

    @api.depends('move_type', 'company_id')
    def _compute_l10n_pe_edi_operation_type(self):
        for move in self:
            move.l10n_pe_edi_operation_type = '0101' if move.country_code == 'PE' and move.is_sale_document() else False

    def _l10n_pe_edi_get_spot(self):
        max_percent = max(self.invoice_line_ids.mapped('product_id.l10n_pe_withhold_percentage'), default=0)
        if not max_percent or not self.l10n_pe_edi_operation_type in ['1001', '1002', '1003', '1004'] or self.move_type == 'out_refund':
            return {}
        line = self.invoice_line_ids.filtered(lambda r: r.product_id.l10n_pe_withhold_percentage == max_percent)[0]
        national_bank = self.env.ref('l10n_pe.peruvian_national_bank')
        national_bank_account = self.company_id.bank_ids.filtered(lambda b: b.bank_id == national_bank)
        # just take the first one (but not meant to have multiple)
        national_bank_account_number = national_bank_account[0].acc_number

        return {
            'id': 'Detraccion',
            'payment_means_id': line.product_id.l10n_pe_withhold_code,
            'payee_financial_account': national_bank_account_number,
            'payment_means_code': '999',
            'spot_amount': float_round(self.amount_total * (max_percent/100.0), precision_rounding=2),
            'amount': float_repr(float_round(self.amount_total_signed * (max_percent/100.0), precision_rounding=2), precision_digits=2),
            'payment_percent': max_percent,
            'spot_message': "Operación sujeta al sistema de Pago de Obligaciones Tributarias-SPOT, Banco de la Nacion %% %s Cod Serv. %s" % (
                line.product_id.l10n_pe_withhold_percentage, line.product_id.l10n_pe_withhold_code) if self.amount_total_signed >= 700.0 else False
        }

    def _l10n_pe_edi_get_payment_means(self):
        payment_means_id = 'Credito'
        if not self.invoice_date_due or self.invoice_date_due == self.invoice_date:
            payment_means_id = 'Contado'
        return payment_means_id
