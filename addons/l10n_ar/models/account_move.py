# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, fields, api, _
from odoo.exceptions import UserError
from dateutil.relativedelta import relativedelta
import logging
_logger = logging.getLogger(__name__)


class AccountMove(models.Model):

    _inherit = 'account.move'

    @staticmethod
    def _l10n_ar_get_document_number_parts(document_number, document_type_code):
        # despachos de importacion
        if document_type_code in ['66', '67']:
            point_of_sale = invoice_number = '0'
        else:
            point_of_sale, invoice_number = document_number.split('-')
        return {'invoice_number': int(invoice_number), 'point_of_sale': int(point_of_sale)}

    l10n_ar_afip_responsability_type_id = fields.Many2one(
        'l10n_ar.afip.responsability.type', string='AFIP Responsability Type', help='Defined by AFIP to'
        ' identify the type of responsabilities that a person or a legal entity could have and that impacts in the'
        ' type of operations and requirements they need.')
    # TODO make it editable, we have to change move creation method
    l10n_ar_currency_rate = fields.Float(copy=False, digits=(16, 4), readonly=True, string="Currency Rate")
    # Mostly used on reports
    l10n_ar_afip_concept = fields.Selection(
        compute='_compute_l10n_ar_afip_concept', inverse='_inverse_l10n_ar_afip_concept',
        selection='get_afip_invoice_concepts', string="AFIP Concept", help="A concept is suggested regarding"
        " the type of the products on the invoice but it is allowed to force a different type if required.",
        readonly=True, states={'draft': [('readonly', False)]})
    l10n_ar_force_afip_concept = fields.Selection(
        selection='get_afip_invoice_concepts', string="Forced AFIP Concept", readonly=True,)
    l10n_ar_afip_service_start = fields.Date(
        string='AFIP Service Start Date', readonly=True, states={'draft': [('readonly', False)]})
    l10n_ar_afip_service_end = fields.Date(
        string='AFIP Service End Date', readonly=True, states={'draft': [('readonly', False)]})

    def get_afip_invoice_concepts(self):
        """ Return the list of values of the selection field. """
        return [('1', 'Products / Definitive export of goods'), ('2', 'Services'), ('3', 'Products and Services'),
                ('4', '4-Other (export)')]

    @api.depends('invoice_line_ids', 'invoice_line_ids.product_id', 'invoice_line_ids.product_id.type',
                 'l10n_ar_force_afip_concept', 'journal_id')
    def _compute_l10n_ar_afip_concept(self):
        for rec in self.filtered(lambda x: x.company_id.country_id == self.env.ref('base.ar')
                                 and x.l10n_latam_use_documents):
            rec.l10n_ar_afip_concept = rec.l10n_ar_force_afip_concept if rec.l10n_ar_force_afip_concept \
                else rec._get_concept()

    @api.multi
    def _inverse_l10n_ar_afip_concept(self):
        for rec in self:
            rec.l10n_ar_force_afip_concept = False if rec._get_concept() == rec.l10n_ar_afip_concept \
                else rec.l10n_ar_afip_concept

    @api.multi
    def _get_concept(self):
        """ Method to get the concept of the invoice considering the type of the products on the invoice """
        self.ensure_one()
        invoice_lines = self.invoice_line_ids
        product_types = set([x.product_id.type for x in invoice_lines if x.product_id])
        consumible = set(['consu', 'product'])
        service = set(['service'])
        mixed = set(['consu', 'service', 'product'])
        # default value "product"
        afip_concept = '1'
        if product_types.issubset(mixed):
            afip_concept = '3'
        if product_types.issubset(service):
            afip_concept = '2'
        if product_types.issubset(consumible):
            afip_concept = '1'
        # on expo invoice you can mix services and products
        if self.l10n_latam_document_type_id.code in ['19', '20', '21'] and afip_concept == '3':
            afip_concept = '1'
        return afip_concept

    @api.multi
    def _get_argentina_amounts(self):
        self.ensure_one()
        tax_lines = self.line_ids.filtered('tax_line_id')
        vat_taxes = tax_lines.filtered(
            lambda r: r.tax_line_id.tax_group_id.l10n_ar_type == 'tax' and r.tax_line_id.tax_group_id.l10n_ar_tax == 'vat')

        # we add and "r.base" because only if a there is a base amount it is considered taxable, this is used for
        # eg to validate invoices on afif. Does not include afip_code [0, 1, 2] because their are not taxes
        # themselves: VAT Exempt, VAT Untaxed and VAT Not applicable
        vat_taxables = vat_taxes.filtered(
            lambda r: r.tax_line_id.tax_group_id.l10n_ar_afip_code not in [0, 1, 2] and r.tax_base_amount)

        # vat exempt values (are the ones with code 2)
        vat_exempt_taxes = tax_lines.filtered(
            lambda r: r.tax_line_id.tax_group_id.l10n_ar_type == 'tax' and r.tax_line_id.tax_group_id.l10n_ar_tax == 'vat' and
            r.tax_line_id.tax_group_id.l10n_ar_afip_code == 2)

        # vat untaxed values / no gravado (are the ones with code 1)
        vat_untaxed_taxes = tax_lines.filtered(
            lambda r: r.tax_line_id.tax_group_id.l10n_ar_type == 'tax' and r.tax_line_id.tax_group_id.l10n_ar_tax == 'vat' and
            r.tax_line_id.tax_group_id.l10n_ar_afip_code == 1)

        # other taxes values
        not_vat_taxes = tax_lines - vat_taxes

        perc_iibb = tax_lines.filtered(lambda r: r.tax_line_id.tax_group_id.l10n_ar_type == 'perception' and r.tax_line_id.tax_group_id.l10n_ar_application == 'provincial_taxes')
        perc_mun = tax_lines.filtered(lambda r: r.tax_line_id.tax_group_id.l10n_ar_type == 'perception' and r.tax_line_id.tax_group_id.l10n_ar_application == 'municipal_taxes')
        imp_internos = tax_lines.filtered(lambda r: r.tax_line_id.tax_group_id.l10n_ar_application == 'others')
        perc_nacionales = tax_lines.filtered(lambda r: r.tax_line_id.tax_group_id.l10n_ar_type == 'perception' and r.tax_line_id.tax_group_id.l10n_ar_application == 'national_taxes')

        return dict(
            vat_tax_ids=vat_taxes,
            vat_taxable_ids=vat_taxables,
            vat_amount=sum(vat_taxes.mapped('price_unit')),
            vat_taxable_amount=sum(vat_taxables.mapped('tax_base_amount')),
            vat_exempt_base_amount=sum(vat_exempt_taxes.mapped('tax_base_amount')),
            vat_untaxed_base_amount=sum(vat_untaxed_taxes.mapped('tax_base_amount')),
            not_vat_tax_ids=not_vat_taxes,
            other_taxes_amount=sum(not_vat_taxes.mapped('price_unit')),
            perc_iibb_amount=sum(perc_iibb.mapped('price_unit')),
            perc_mun_amount=sum(perc_mun.mapped('price_unit')),
            imp_internos_amount=sum(imp_internos.mapped('price_unit')),
            perc_nacionales_amount=sum(perc_nacionales.mapped('price_unit')),
        )

    @api.multi
    def action_invoice_open(self):
        for rec in self.filtered(lambda x: x.company_id.country_id == self.env.ref('base.ar')):
            if rec.company_id.currency_id == rec.currency_id:
                l10n_ar_currency_rate = 1.0
            else:
                l10n_ar_currency_rate = rec.currency_id._convert(
                    1.0, rec.company_id.currency_id, rec.company_id, rec.invoice_date or fields.Date.today(),
                    round=False)
            rec.l10n_ar_currency_rate = l10n_ar_currency_rate
        return super().action_invoice_open()

    def _get_l10n_latam_documents_domain(self):
        self.ensure_one()
        domain = super()._get_l10n_latam_documents_domain()
        if self.journal_id.company_id.country_id == self.env.ref('base.ar'):
            letters = self.journal_id.get_journal_letter(counterpart_partner=self.partner_id.commercial_partner_id)
            domain += ['|', ('l10n_ar_letter', '=', False), ('l10n_ar_letter', 'in', letters)]
            codes = self.journal_id.get_journal_codes()
            if codes:
                domain.append(('code', 'in', codes))
        return domain

    @api.multi
    def check_argentinian_invoice_taxes(self):
        """ We consider argentinian invoices the ones from companies with localization AR that belongs to a journal
        with use_documents """
        _logger.info('Running checks related to argentinian documents')

        # check that there is one and only one vat tax per invoice line
        for inv_line in self.filtered(
                lambda x: x.company_id.l10n_ar_company_requires_vat).mapped('invoice_line_ids'):
            vat_taxes = inv_line.tax_ids.filtered(
                lambda x: x.tax_group_id.l10n_ar_tax == 'vat' and x.tax_group_id.l10n_ar_type == 'tax')
            if len(vat_taxes) != 1:
                raise UserError(_(
                    'Debe haber un y solo un impuesto de IVA por línea. Verificar líneas con producto "%s"' % (
                        inv_line.product_id.name)))

        # check partner has responsability so it will be assigned on invoice validate
        without_responsability = self.filtered(
            lambda x: not x.partner_id.l10n_ar_afip_responsability_type_id)
        if without_responsability:
            raise UserError(_(
                'The following invoices has a partner without AFIP responsability:\n\n%s') % ('\n'.join(
                    ['[%i] %s' % (i.id, i.display_name) for i in without_responsability])))

        # verificamos facturas de compra que deben reportar cuit y no lo tienen configurado
        without_cuit = self.filtered(
            lambda x: x.type in ['in_invoice', 'in_refund'] and x.l10n_latam_document_type_id.purchase_cuit_required and
            not x.commercial_partner_id.l10n_ar_cuit)
        if without_cuit:
            raise UserError(_('Las siguientes partners no tienen configurado CUIT: %s') % (', '.join(
                without_cuit.mapped('commercial_partner_id.name'))))

        # facturas que no debería tener ningún iva y tienen
        not_zero_alicuot = self.filtered(
            lambda x: x.type in ['in_invoice', 'in_refund'] and x.l10n_latam_document_type_id.purchase_alicuots == 'zero'
            and any([t.tax_id.tax_group_id.l10n_ar_afip_code != 0
                     for t in x._get_argentina_amounts()['vat_tax_ids']]))
        if not_zero_alicuot:
            raise UserError(_(
                'Las siguientes facturas tienen configurados IVA incorrecto. Debe utilizar IVA no corresponde.\n'
                '*Facturas: %s') % (', '.join(not_zero_alicuot.mapped('display_name'))))

        # facturas que debería tener iva y tienen no corresponde
        zero_alicuot = self.filtered(
            lambda x: x.type in ['in_invoice', 'in_refund']
            and x.l10n_latam_document_type_id.purchase_alicuots == 'not_zero' and
            any([t.tax_id.tax_group_id.l10n_ar_afip_code == 0
                 for t in x._get_argentina_amounts()['vat_tax_ids']]))
        if zero_alicuot:
            raise UserError(_(
                'Las siguientes facturas tienen IVA no corresponde pero debe seleccionar una alícuota correcta'
                ' (No gravado, Exento, Cero, 10,5, etc).\n*Facturas: %s') % (', '.join(
                    zero_alicuot.mapped('display_name'))))

    @api.constrains('invoice_date')
    def set_date_afip(self):
        for rec in self.filtered('invoice_date'):
            invoice_date = fields.Datetime.from_string(rec.invoice_date)
            vals = {}
            if not rec.l10n_ar_afip_service_start:
                vals['l10n_ar_afip_service_start'] = invoice_date + relativedelta(day=1)
            if not rec.l10n_ar_afip_service_end:
                vals['l10n_ar_afip_service_end'] = invoice_date + relativedelta(day=1, days=-1, months=+1)
            if vals:
                rec.write(vals)

    @api.onchange('partner_id')
    def check_afip_responsability_set(self):
        if self.company_id.country_id == self.env.ref('base.ar') and self.l10n_latam_use_documents and self.partner_id \
           and not self.partner_id.l10n_ar_afip_responsability_type_id:
            return {'warning': {
                'title': 'Missing Partner Configuration',
                'message': 'Please configure the AFIP Responsability for "%s" in order to continue' % (
                    self.partner_id.name)}}

    def get_document_type_sequence(self):
        """ Return the match sequences for the given journal and invoice """
        self.ensure_one()
        if self.journal_id.l10n_latam_use_documents and self.l10n_latam_country_code == 'AR':
            if self.journal_id.l10n_ar_share_sequences:
                return self.journal_id.l10n_ar_sequence_ids.filtered(
                    lambda x: x.l10n_ar_letter == self.l10n_latam_document_type_id.l10n_ar_letter)
            res = self.journal_id.l10n_ar_sequence_ids.filtered(
                lambda x: x.l10n_latam_document_type_id == self.l10n_latam_document_type_id)
            return res
        return super().get_document_type_sequence()

    # TODO make it with crate/write or with https://github.com/odoo/odoo/pull/31059
    # para cuando se crea, por ej, desde ventas o contratos
    @api.constrains('partner_id')
    @api.onchange('partner_id')
    def _onchange_partner_journal(self):
        expo_journals = ['FEERCEL', 'FEEWS', 'FEERCELP']
        for rec in self.filtered(lambda x: x.company_id.country_id == self.env.ref('base.ar') and x.journal_id.type == 'sale'
                                 and x.l10n_latam_use_documents and x.partner_id.l10n_ar_afip_responsability_type_id):
            res_code = rec.partner_id.l10n_ar_afip_responsability_type_id.code
            domain = [('company_id', '=', rec.company_id.id), ('l10n_latam_use_documents', '=', True), ('type', '=', 'sale')]
            journal = self.env['account.journal']
            if res_code in ['8', '9', '10'] and rec.journal_id.l10n_ar_afip_pos_system not in expo_journals:
                # if partner is foregin and journal is not of expo, we try to change to expo journal
                journal = journal.search(domain + [('l10n_ar_afip_pos_system', 'in', expo_journals)], limit=1)
            elif res_code not in ['8', '9', '10'] and rec.journal_id.l10n_ar_afip_pos_system in expo_journals:
                # if partner is NOT foregin and journal is for expo, we try to change to local journal
                journal = journal.search(domain + [('l10n_ar_afip_pos_system', 'not in', expo_journals)], limit=1)
            if journal:
                rec.journal_id = journal.id

    # TODO move this patch to account module (between patch comments)
    @api.multi
    def _move_autocomplete_invoice_lines_values(self):
        ''' This method recomputes dynamic lines on the current journal entry that include taxes, cash rounding
        and payment terms lines.
        '''
        self.ensure_one()

        line_currency = self.currency_id if self.currency_id != self.company_id.currency_id else False
        for line in self.line_ids:
            # Do something only on invoice lines.
            if line.exclude_from_invoice_tab:
                continue

            # Ensure related fields are well copied.
            line.partner_id = self.partner_id
            line.date = self.date
            line.recompute_tax_line = True
            line.currency_id = line_currency

            # Shortcut to load the demo data.
            if not line.account_id:
                line.account_id = line._get_computed_account()
                if not line.account_id:
                    if self.is_sale_document(include_receipts=True):
                        line.account_id = self.journal_id.default_credit_account_id
                    elif self.is_purchase_document(include_receipts=True):
                        line.account_id = self.journal_id.default_debit_account_id

            # PATCH START
            # Shortcut to load the demo data.
            if not line.tax_ids:
                line.tax_ids = line._get_computed_taxes()
            # PATCH END

        self.line_ids._onchange_price_subtotal()
        self._recompute_dynamic_lines(recompute_all_taxes=True)

        values = self._convert_to_write(self._cache)
        values.pop('invoice_line_ids', None)
        return values

    @api.multi
    def post(self):
        ar_invoices = self.filtered(lambda x: x.company_id.country_id == self.env.ref('base.ar') and x.l10n_latam_use_documents)
        for rec in ar_invoices:
            rec.l10n_ar_afip_responsability_type_id = rec.commercial_partner_id.l10n_ar_afip_responsability_type_id.id
        # We make validations here and not with a constraint because we want validaiton before sending electronic
        # data on l10n_ar_edi
        ar_invoices.check_argentinian_invoice_taxes()
        return super().post()

    @api.multi
    def _reverse_moves(self, default_values_list=None, cancel=False):
        if not default_values_list:
            default_values_list = [{} for move in self]
        for move, default_values in zip(self, default_values_list):
            default_values.update({
                # TODO enable when we make l10n_ar_currency_rate editable
                # 'l10n_ar_currency_rate': move.l10n_ar_currency_rate,
                'l10n_ar_afip_service_start': move.l10n_ar_afip_service_start,
                'l10n_ar_afip_service_end': move.l10n_ar_afip_service_end,
            })
        return super()._reverse_moves(default_values_list=default_values_list, cancel=cancel)
