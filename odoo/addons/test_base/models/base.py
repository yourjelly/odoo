# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api
import datetime

#ResPartner

class BaseModel(models.Model):
    _description = 'Contact'
	_name = "test_base.base"
	_order = "display_name" #??

    def _default_category(self):
        return self.env['test_base.category'].browse(self._context.get('category_id'))

	#used in test_search
	name = fields.Char(index=True)
	display_name = fields.Char(store=True, index=True)		#compute='_compute_display_name',
	active = fields.Boolean(default=True)
    email = fields.Char()
    color = fields.Integer(string='Color Index', default=0)
    is_company = fields.Boolean(string='Is a Company', default=False,
        help="Check if the contact is a company, otherwise it is a person")
    date = fields.Date(index=True)
    title = fields.Many2one('test_base.title')
    category_id = fields.Many2many('test_base.category', column1='partner_id',
                                    column2='category_id', string='Tags', default=_default_category)
    parent_id = fields.Many2one('test_base.base', string='Related Company', index=True)
    user_ids = fields.One2many('test_base.base', 'partner_id', string='Users', auto_join=True)
    child_ids = fields.One2many('test_base.base', 'parent_id', string='Contacts', domain=[('active', '=', True)])
    vat = fields.Char(string='TIN', help="Tax Identification Number. "
                                         "Fill it if the company is subjected to taxes. "
                                         "Used by the some of the legal statements.")
    phone = fields.Char()
    street = fields.Char()
	city = fields.Char()
    type = fields.Selection(
        [('contact', 'Contact'),
         ('invoice', 'Invoice address'),
         ('delivery', 'Shipping address'),
         ('other', 'Other address')], string='Address Type',
        default='contact',
        help="Used to select automatically the right address according to the context in sales and purchases documents.")


class PartnerTitle(models.Model):
    _name = 'test_base.title'
    _order = 'name'

    name = fields.Char(string='Title', required=True, translate=True)


class ResUsers(models.Model):
    _name = "test_base.inherited"
    _description = 'Users'
    _inherits = {'test_base.base': 'partner_id'}
    _order = 'name, login'

    partner_id = fields.Many2one('test_base.base', required=True, ondelete='restrict', auto_join=True,
        string='Related Partner', help='Partner-related data of the user')
    login = fields.Char(required=True, help="Used to log into the system")


class ResCurrency(models.Model):
    _name = "test_base.currency"
    _description = "Currency"
    _order = 'active desc, name'

    name = fields.Char(string='Currency', size=3, required=True, help="Currency Code (ISO 4217)")
    symbol = fields.Char(help="Currency sign, to be used when printing amounts.", required=True)
    rounding = fields.Float(string='Rounding Factor', digits=(12, 6), default=0.01)
    rate_ids = fields.One2many('test_base.currency.rate', 'currency_id', string='Rates')


class ResCurrencyRate(models.Model):
    _name = "test_base.currency.rate"
    _description = "Currency Rate"
    _order = "name desc"

    name = fields.Date(string='Date', required=True, index=True,
                           default=lambda self: fields.Date.today())
    rate = fields.Float(digits=(12, 6), default=1.0, help='The rate of the currency to the currency of rate 1')
    currency_id = fields.Many2one('test_base.currency', string='Currency', readonly=True)


class PartnerCategory(models.Model):
    _description = 'Partner Tags'
    _name = 'test_base.category'
    _order = 'name'
    _parent_store = True
    name = fields.Char(string='Tag Name', required=True, translate=True)
    parent_id = fields.Many2one('test_base.category', string='Parent Category', index=True, ondelete='cascade')
    child_ids = fields.One2many('test_base.category', 'parent_id', string='Child Tags')

    @api.constrains('parent_id')
    def _check_parent_id(self):
        if not self._check_recursion():
            raise ValidationError(_('Error ! You can not create recursive tags.'))


#ResPartnerBank
def sanitize_account_number(acc_number):
    if acc_number:
        return re.sub(r'\W+', '', acc_number).upper()
    return False

class ResPartnerBank(models.Model):
	_name = 'test_base.base.bank'
	_description = 'Bank Accounts'

	acc_type = fields.Selection([('bank', 'Normal')], compute='_compute_acc_type', string='Type', help='Bank account type: Normal or IBAN. Inferred from the bank account number.')
	acc_number = fields.Char('Account Number', required=True)
	sanitized_acc_number = fields.Char(compute='_compute_sanitized_acc_number', string='Sanitized Account Number', readonly=True, store=True)
	partner_id = fields.Many2one('test_base.base', 'Account Holder', ondelete='cascade', index=True, required=True) #, domain=['|', ('is_company', '=', True), ('parent_id', '=', False)],

	@api.depends('acc_number')
    def _compute_sanitized_acc_number(self):
        for bank in self:
            bank.sanitized_acc_number = sanitize_account_number(bank.acc_number)

	@api.multi
    def _compute_acc_type(self):
        for bank in self:
            bank.acc_type = 'bank'

    @api.model
    def search(self, args, offset=0, limit=None, order=None, count=False):
        pos = 0
        while pos < len(args):
            if args[pos][0] == 'acc_number':
                op = args[pos][1]
                value = args[pos][2]
                if not isinstance(value, pycompat.string_types) and isinstance(value, collections.Iterable):
                    value = [sanitize_account_number(i) for i in value]
                else:
                    value = sanitize_account_number(value)
                if 'like' in op:
                    value = '%' + value + '%'
                args[pos] = ('sanitized_acc_number', op, value)
            pos += 1
        return super(ResPartnerBank, self).search(args, offset, limit, order, count=count)
