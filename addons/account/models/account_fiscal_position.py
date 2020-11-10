# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class AccountFiscalPositionCommon(models.AbstractModel):
    _name = "account.fiscal.position.common"
    _description = "Common between account.fiscal.position & account.fiscal.position.template"

    sequence = fields.Integer(default=10)
    name = fields.Char(
        string="Fiscal Position",
        required=True)
    auto_apply = fields.Boolean(
        string="Detect Automatically",
        help="Apply automatically this fiscal position.")
    vat_required = fields.Boolean(
        string="VAT required",
        help="Apply only if partner has a VAT number.")
    note = fields.Text(
        string="Notes",
        translate=True)
    state_ids = fields.Many2many(
        comodel_name='res.country.state',
        string="Federal States",
        store=True, readonly=False,
        compute='_compute_state_ids')
    zip_from = fields.Char(
        string="Zip Range From",
        store=True, readonly=False,
        compute='_compute_zip_from')
    zip_to = fields.Char(
        string="Zip Range To",
        store=True, readonly=False,
        compute='_compute_zip_to')
    country_id = fields.Many2one(
        comodel_name='res.country',
        string="Country",
        help="Apply only if delivery country matches.")
    country_group_id = fields.Many2one(
        comodel_name='res.country.group',
        string="Country Group",
        help="Apply only if delivery country matches the group.")

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('country_id', 'country_group_id')
    def _compute_zip_from(self):
        for fpos in self:
            if fpos.country_id or fpos.country_group_id:
                fpos.zip_from = False
            else:
                fpos.zip_from = fpos.zip_from

    @api.depends('country_id', 'country_group_id')
    def _compute_zip_to(self):
        for fpos in self:
            if fpos.country_id or fpos.country_group_id:
                fpos.zip_to = False
            else:
                fpos.zip_to = fpos.zip_to

    @api.depends('country_id', 'country_group_id')
    def _compute_state_ids(self):
        for fpos in self:
            if fpos.country_id or fpos.country_group_id:
                fpos.state_ids = [(5,)]
            else:
                fpos.state_ids = fpos.state_ids

    # -------------------------------------------------------------------------
    # ONCHANGE METHODS
    # -------------------------------------------------------------------------

    @api.onchange('country_id')
    def _onchange_country_id(self):
        if self.country_id:
            self.country_group_id = False

    @api.onchange('country_group_id')
    def _onchange_country_group_id(self):
        if self.country_group_id:
            self.country_id = False

    # -------------------------------------------------------------------------
    # CONSTRAINTS
    # -------------------------------------------------------------------------

    @api.constrains('zip_from', 'zip_to')
    def _check_zip(self):
        for position in self:
            if position.zip_from and position.zip_to and position.zip_from > position.zip_to:
                raise ValidationError(_('Invalid "Zip Range", please configure it properly.'))


class AccountFiscalPositionTemplate(models.Model):
    _name = "account.fiscal.position.template"
    _inherit = 'account.fiscal.position.common'
    _description = "Template for Fiscal Position"

    chart_template_id = fields.Many2one(
        string="Chart Template",
        comodel_name='account.chart.template',
        required=True)
    account_ids = fields.One2many(
        comodel_name='account.fiscal.position.account.template',
        inverse_name='position_id',
        string="Account Mapping")
    tax_ids = fields.One2many(
        comodel_name='account.fiscal.position.tax.template',
        inverse_name='position_id',
        string="Tax Mapping")


class AccountFiscalPosition(models.Model):
    _name = "account.fiscal.position"
    _inherit = 'account.fiscal.position.common'
    _description = "Fiscal Position"
    _order = 'sequence'

    active = fields.Boolean(
        default=True,
        help="By unchecking the active field, you may hide a fiscal position without deleting it.")
    company_id = fields.Many2one(
        comodel_name='res.company',
        string='Company', required=True, readonly=True,
        default=lambda self: self.env.company)
    account_ids = fields.One2many(
        comodel_name='account.fiscal.position.account',
        inverse_name='position_id',
        string="Account Mapping",
        copy=True)
    tax_ids = fields.One2many(
        comodel_name='account.fiscal.position.tax',
        inverse_name='position_id',
        string="Tax Mapping",
        copy=True)

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    @api.model
    def _convert_zip_values(self, zip_from='', zip_to=''):
        max_length = max(len(zip_from), len(zip_to))
        if zip_from.isdigit():
            zip_from = zip_from.rjust(max_length, '0')
        if zip_to.isdigit():
            zip_to = zip_to.rjust(max_length, '0')
        return zip_from, zip_to

    @api.model
    def create(self, vals):
        # OVERRIDE
        zip_from = vals.get('zip_from')
        zip_to = vals.get('zip_to')
        if zip_from and zip_to:
            vals['zip_from'], vals['zip_to'] = self._convert_zip_values(zip_from, zip_to)
        return super(AccountFiscalPosition, self).create(vals)

    def write(self, vals):
        # OVERRIDE
        zip_from = vals.get('zip_from')
        zip_to = vals.get('zip_to')
        if zip_from or zip_to:
            for rec in self:
                vals['zip_from'], vals['zip_to'] = self._convert_zip_values(zip_from or rec.zip_from, zip_to or rec.zip_to)
        return super(AccountFiscalPosition, self).write(vals)

    # -------------------------------------------------------------------------
    # BUSINESS METHODS
    # -------------------------------------------------------------------------

    def map_tax(self, taxes, product=None, partner=None):
        if not self:
            return taxes
        result = self.env['account.tax']
        for tax in taxes:
            taxes_correspondance = self.tax_ids.filtered(lambda t: t.tax_src_id == tax)
            result |= taxes_correspondance.tax_dest_id if taxes_correspondance else tax
        return result

    def map_account(self, account):
        for pos in self.account_ids:
            if pos.account_src_id == account:
                return pos.account_dest_id
        return account

    def map_accounts(self, accounts):
        """ Receive a dictionary having accounts in values and try to replace those accounts accordingly to the fiscal position.
        """
        ref_dict = {}
        for line in self.account_ids:
            ref_dict[line.account_src_id] = line.account_dest_id
        for key, acc in accounts.items():
            if acc in ref_dict:
                accounts[key] = ref_dict[acc]
        return accounts

    @api.model
    def _get_fpos_by_region(self, country_id=False, state_id=False, zipcode=False, vat_required=False):
        if not country_id:
            return False
        base_domain = [
            ('auto_apply', '=', True),
            ('vat_required', '=', vat_required),
            ('company_id', 'in', [self.env.company.id, False]),
        ]
        null_state_dom = state_domain = [('state_ids', '=', False)]
        null_zip_dom = zip_domain = [('zip_from', '=', False), ('zip_to', '=', False)]
        null_country_dom = [('country_id', '=', False), ('country_group_id', '=', False)]

        if zipcode:
            zip_domain = [('zip_from', '<=', zipcode), ('zip_to', '>=', zipcode)]

        if state_id:
            state_domain = [('state_ids', '=', state_id)]

        domain_country = base_domain + [('country_id', '=', country_id)]
        domain_group = base_domain + [('country_group_id.country_ids', '=', country_id)]

        # Build domain to search records with exact matching criteria
        fpos = self.search(domain_country + state_domain + zip_domain, limit=1)
        # return records that fit the most the criteria, and fallback on less specific fiscal positions if any can be found
        if not fpos and state_id:
            fpos = self.search(domain_country + null_state_dom + zip_domain, limit=1)
        if not fpos and zipcode:
            fpos = self.search(domain_country + state_domain + null_zip_dom, limit=1)
        if not fpos and state_id and zipcode:
            fpos = self.search(domain_country + null_state_dom + null_zip_dom, limit=1)

        # fallback: country group with no state/zip range
        if not fpos:
            fpos = self.search(domain_group + null_state_dom + null_zip_dom, limit=1)

        if not fpos:
            # Fallback on catchall (no country, no group)
            fpos = self.search(base_domain + null_country_dom, limit=1)
        return fpos

    @api.model
    def get_fiscal_position(self, partner_id, delivery_id=None):
        """
        :return: fiscal position found (recordset)
        :rtype: :class:`account.fiscal.position`
        """
        if not partner_id:
            return self.env['account.fiscal.position']

        # This can be easily overridden to apply more complex fiscal rules
        PartnerObj = self.env['res.partner']
        partner = PartnerObj.browse(partner_id)

        # if no delivery use invoicing
        if delivery_id:
            delivery = PartnerObj.browse(delivery_id)
        else:
            delivery = partner

        # partner manually set fiscal position always win
        if delivery.property_account_position_id or partner.property_account_position_id:
            return delivery.property_account_position_id or partner.property_account_position_id

        # First search only matching VAT positions
        vat_required = bool(partner.vat)
        fp = self._get_fpos_by_region(delivery.country_id.id, delivery.state_id.id, delivery.zip, vat_required)

        # Then if VAT required found no match, try positions that do not require it
        if not fp and vat_required:
            fp = self._get_fpos_by_region(delivery.country_id.id, delivery.state_id.id, delivery.zip, False)

        return fp or self.env['account.fiscal.position']


class AccountFiscalPositionTaxTemplate(models.Model):
    _name = "account.fiscal.position.tax.template"
    _description = "Tax Mapping Template of Fiscal Position"
    _rec_name = 'position_id'

    position_id = fields.Many2one('account.fiscal.position.template', string='Fiscal Position', required=True, ondelete='cascade')
    tax_src_id = fields.Many2one('account.tax.template', string='Tax Source', required=True)
    tax_dest_id = fields.Many2one('account.tax.template', string='Replacement Tax')


class AccountFiscalPositionTax(models.Model):
    _name = "account.fiscal.position.tax"
    _description = "Tax Mapping of Fiscal Position"
    _rec_name = 'position_id'
    _check_company_auto = True

    position_id = fields.Many2one('account.fiscal.position', string='Fiscal Position',
        required=True, ondelete='cascade')
    company_id = fields.Many2one('res.company', string='Company', related='position_id.company_id', store=True)
    tax_src_id = fields.Many2one('account.tax', string='Tax on Product', required=True, check_company=True)
    tax_dest_id = fields.Many2one('account.tax', string='Tax to Apply', check_company=True)

    _sql_constraints = [
        ('tax_src_dest_uniq',
         'unique (position_id,tax_src_id,tax_dest_id)',
         'A tax fiscal position could be defined only one time on same taxes.')
    ]


class AccountFiscalPositionAccountTemplate(models.Model):
    _name = 'account.fiscal.position.account.template'
    _description = 'Accounts Mapping Template of Fiscal Position'
    _rec_name = 'position_id'

    position_id = fields.Many2one('account.fiscal.position.template', string='Fiscal Mapping', required=True, ondelete='cascade')
    account_src_id = fields.Many2one('account.account.template', string='Account Source', required=True)
    account_dest_id = fields.Many2one('account.account.template', string='Account Destination', required=True)


class AccountFiscalPositionAccount(models.Model):
    _name = 'account.fiscal.position.account'
    _description = 'Accounts Mapping of Fiscal Position'
    _rec_name = 'position_id'
    _check_company_auto = True

    position_id = fields.Many2one('account.fiscal.position', string='Fiscal Position',
        required=True, ondelete='cascade')
    company_id = fields.Many2one('res.company', string='Company', related='position_id.company_id', store=True)
    account_src_id = fields.Many2one('account.account', string='Account on Product',
        check_company=True, required=True,
        domain="[('deprecated', '=', False), ('company_id', '=', company_id)]")
    account_dest_id = fields.Many2one('account.account', string='Account to Use Instead',
        check_company=True, required=True,
        domain="[('deprecated', '=', False), ('company_id', '=', company_id)]")

    _sql_constraints = [
        ('account_src_dest_uniq',
         'unique (position_id,account_src_id,account_dest_id)',
         'An account fiscal position could be defined only one time on same accounts.')
    ]
