# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import logging
import uuid
from ast import literal_eval

import requests
from dateutil.parser import parse
from pytz import UTC
from werkzeug.urls import url_join
from pprint import pformat

from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError
from odoo.osv import expression

from odoo.addons.mail.tools import mail_validation
from odoo.addons.odoo_payments import const
from odoo.addons.odoo_payments.controllers.onboarding import OnboardingController
from odoo.addons.odoo_payments.utils import AdyenProxyAuth
from odoo.addons.phone_validation.tools import phone_validation

_logger = logging.getLogger(__name__)


class AdyenAccount(models.Model):
    _name = 'adyen.account'
    _inherit = ['mail.thread', 'adyen.id.mixin', 'adyen.address.mixin']
    _description = "Odoo Payments Account"
    _rec_name = 'full_name'

    #=== DEFAULT METHODS ===#

    merchant_status = fields.Selection(
        string="Merchant Status",
        help="The status of the Adyen account on the merchant database (internal). The account"
             "transitions from one merchant status to another as follows:\n"
             "1.  The account is created -> Draft\n"
             "2.  The user is redirected to the merchant database -> Pending Validation\n"
             "3a. Adyen confirms the creation of the account -> Active (test environment only)\n"
             "3b. The merchant validates the account -> Active (live environment only)\n"
             "3c. The merchant rejects the creation of the account -> Closed\n"
             "4.  The merchant closes the account -> Closed",
        selection=[
            ('draft', "Draft"),
            ('pending', "Pending Validation"),
            ('active', "Active"),
            ('closed', "Closed"),
        ],
        default='draft',
        readonly=True,
    )
    kyc_state = fields.Selection(
        string="KYC State",
        help="The summary of the states of the KYC checks. The KYC state corresponds to:\n"
             "- At least one KYC check is in 'awaiting_data' -> Data To Provide\n"
             "- All data are provided but at least one KYC check is in 'pending' ->"
             "  Data Validation\n"
             "- All KYC check are in 'passed' -> Validated",
        selection=[
            ('data_to_provide', "Data To Provide"),
            ('validation', "Data Validation"),
            ('validated', "Validated"),
        ],
        compute='_compute_kyc_state',
    )

    #=========== ANY FIELD BELOW THIS LINE HAS NOT BEEN CLEANED YET ===========#

    # Credentials
    adyen_uuid = fields.Char(string="Adyen UUID")
    account_holder_code = fields.Char(
        string="Account Holder Code", default=lambda self: uuid.uuid4().hex)
    proxy_token = fields.Char(string="Proxy Token")

    company_id = fields.Many2one(
        comodel_name='res.company', required=True, default=lambda self: self.env.company)

    bank_account_ids = fields.One2many(
        string="Bank Accounts", comodel_name='adyen.bank.account', inverse_name='adyen_account_id',
        sync_with_adyen=True)
    shareholder_ids = fields.One2many(
        string="Shareholders", comodel_name='adyen.shareholder', inverse_name='adyen_account_id',
        sync_with_adyen=True)

    transaction_ids = fields.One2many(
        string="Transactions", comodel_name='adyen.transaction', inverse_name='adyen_account_id')
    transactions_count = fields.Integer(compute='_compute_transactions_count')

    transaction_payout_ids = fields.One2many(
        comodel_name='adyen.transaction.payout', inverse_name='adyen_account_id')
    payouts_count = fields.Integer(compute='_compute_payouts_count')

    payment_journal_id = fields.Many2one(
        string="Payment Journal", comodel_name='account.journal',
        compute='_compute_payment_journal_id', inverse='_inverse_payment_journal_id',
        help="The journal in which the successful transactions are posted",
        domain="[('type', '=', 'bank'), ('company_id', '=', company_id)]")

    # UX flag to know if the user has to select/create a journal or if it will be created automatically for him.
    need_to_provide_payment_journal = fields.Boolean(
        compute="_compute_need_to_provide_payment_journal")

    entity_type = fields.Selection(
        selection=[
            ('business', "Business"),
            ('individual', "Individual"),
            ('nonprofit', "Non Profit"),
        ], string="Legal Entity Type", required=True,
        sync_with_adyen=True)

    # Contact Info #
    # Individual
    first_name = fields.Char(string="First Name", sync_with_adyen=True)
    last_name = fields.Char(string="Last Name", sync_with_adyen=True)
    date_of_birth = fields.Date(string="Date of birth", sync_with_adyen=True)
    document_number = fields.Char(
        string="ID Number",
        help="The type of ID Number required depends on the country:\n"
             "US: Social Security Number (9 digits or last 4 digits)\n"
             "Canada: Social Insurance Number\nItaly: Codice fiscale\n"
             "Australia: Document Number",
        sync_with_adyen=True)
    document_type = fields.Selection(
        string="Document Type",
        selection=[
            ('ID', "ID"),
            ('PASSPORT', "Passport"),
            ('VISA', "Visa"),
            ('DRIVINGLICENSE', "Driving license"),
        ], default='ID',
        sync_with_adyen=True)

    # Business / Non Profit
    legal_business_name = fields.Char(string="Legal Business Name", sync_with_adyen=True)
    doing_business_as = fields.Char(string="Doing Business As", sync_with_adyen=True)
    registration_number = fields.Char(string="Registration Number", sync_with_adyen=True)

    # Shared contact info (Business/Individual/NonProfit)
    full_name = fields.Char(compute='_compute_full_name')
    email = fields.Char(string="Email", required=True, tracking=True, sync_with_adyen=True)
    phone_number = fields.Char(string="Phone Number", required=True, tracking=True, sync_with_adyen=True)

    # Payout
    account_code = fields.Char(string="Account Code")
    payout_schedule = fields.Selection(
        selection=[
            ('daily', "Daily"),
            ('weekly', "Weekly"),
            ('biweekly', "Bi-weekly"),
            ('monthly', "Monthly"),
        ], default='biweekly', required=True, string="Payout Schedule", tracking=True)
    next_scheduled_payout = fields.Datetime(string="Next Scheduled Payout", readonly=True)
    last_sync_date = fields.Datetime(default=fields.Datetime.now)
    payout_allowed = fields.Boolean(readonly=True)
    onboarding_msg = fields.Html(compute='_compute_onboarding_msg')

    # KYC
    adyen_kyc_ids = fields.One2many(
        string="KYC Checks", comodel_name='adyen.kyc', inverse_name='adyen_account_id', readonly=True)
    kyc_tier = fields.Integer(string="KYC Tier", default=0, readonly=True)
    kyc_status_message = fields.Html(compute='_compute_kyc_status')

    is_test = fields.Boolean(string="Test Account", help="Cannot be modified after account creation.")

    _sql_constraints = [
        ('adyen_uuid_uniq', 'UNIQUE(adyen_uuid)', "Adyen UUID should be unique"),
    ]

    #=== COMPUTE METHODS ===#

    @api.depends('transaction_ids')
    def _compute_transactions_count(self):
        for account in self:
            account.transactions_count = len(account.transaction_ids)

    @api.depends('transaction_payout_ids')
    def _compute_payouts_count(self):
        for account in self:
            account.payouts_count = len(account.transaction_payout_ids)

    #=== CONSTRAINT METHODS ===#

    #=== CRUD METHODS ===#

    @api.model
    def create(self, values):
        adyen_account = super().create(values)

        # Set the payment journal for the Odoo payment acquirer if not yet created by the user
        if not adyen_account.payment_journal_id:
            payment_journal = self.env['account.journal'].search(
                [('company_id', '=', adyen_account.company_id.id), ('type', '=', 'bank')],
                limit=1
            )
            if payment_journal:
                adyen_account.payment_journal_id = payment_journal

        # Assign the account to the company. The company is read from the account rather than from
        # the env in case the account is created from a company A for a company B.
        adyen_account.company_id.adyen_account_id = adyen_account.id

        return adyen_account

    #=== ACTION METHODS ===#

    @api.model
    def _action_create_or_view(self):
        """ Return an action to create the account if it doesn't exist yet, or to browse it.

        This method must always be used to either create or browse the adyen account. If an account
        is found on the current company, the returned action contains the `res_id` of the account.
        Otherwise, the user is prompted to create a new account.

        :return: The appropriate action to either browse or create the account
        :rtype: dict
        """
        action = self.env['ir.actions.actions']._for_xml_id(
            'odoo_payments.action_view_adyen_account'
        )
        if self.env.company.adyen_account_id:
            action.update(res_id=self.env.company.adyen_account_id.id)
        return action

    #=== BUSINESS METHODS ===#

    def _handle_account_holder_created_notification(self):
        """ Handle `ACCOUNT_HOLDER_CREATED` notifications and update `merchant_status` accordingly.

        Upon receiving the notification, the account's `merchant_status` is immediately set to
        'active' if it is a test account because these do no go through the validation by the
        support. If the account is created in the live environment, no action is performed because
        we are waiting for the validation notification.

        Note: sudoed environment
        Note: self.ensure_one()

        :return: None
        """
        self.ensure_one()

        if self.is_test:
            if self.merchant_status == 'active':
                _logger.info(
                    "tried to update merchant_status with same value: active (uuid: %s)",
                    self.adyen_uuid,
                )
            else:
                self._set_active()
        else:
            pass  # Live accounts are only set active after validation by the support

    def _handle_merchant_status_change_notification(self, content):
        """ Handle `MERCHANT_STATUS_CHANGE` notifications and update `merchant_status` accordingly.

        This notification is received when the support team performs a manual update of the
        submerchant's status on the merchant database (internal). The account's `merchant_status` is
        updated with the new status of the submerchant. An email is sent from the merchant database
        to inform the client.

        Note: sudoed environment
        Note: self.ensure_one()

        :param dict content: The notification content with the following structure:
                             {'newStatus': new_status}
        :return: None
        """
        self.ensure_one()

        new_status = content.get('newStatus')
        if new_status == 'rejected':  # TODO no longer needed when 'rejected' renamed to 'closed' on internal
            new_status = 'closed'  # TODO no longer needed when 'rejected' renamed to 'closed' on internal
        if new_status == self.merchant_status:
            _logger.info(
                "tried to update merchant_status with same value: %(status)s (uuid: %(uuid)s)",
                {'status': new_status, 'uuid': self.adyen_uuid},
            )
        else:
            old_status = self.merchant_status
            if new_status == 'active':
                self._set_active()
            else:  # 'closed'
                self._set_closed()
            _logger.info(
                "updated merchant status from %(old_status)s to %(new_status)s (uuid: %(uuid)s)",
                {'old_status': old_status, 'new_status': new_status, 'uuid': self.adyen_uuid},
            )

    def _set_active(self):
        """ Update the account's merchant status to 'active'.

        The first linked payment acquirer is also enabled to allow smooth onboarding. If other
        payment acquirers are linked to this account, they are left disabled and must be enabled
        manually.

        Note: self.ensure_one()

        :return: None
        """
        self.ensure_one()

        # Activate the account
        self.with_context(update_from_adyen=True).merchant_status = 'active'

        # Enable the initial linked payment acquirer
        payment_acquirer = self.env['payment.acquirer'].search(
            [('provider', '=', 'odoo'), ('company_id', '=', self.company_id.id)], limit=1
        )
        if payment_acquirer:
            payment_acquirer.state = 'enabled' if not self.is_test else 'test'

        # Enable the additional menus after account activation
        balance_menu = self.env.ref('odoo_payments.menu_adyen_balance')
        transactions_menu = self.env.ref('odoo_payments.menu_adyen_transaction')
        (balance_menu + transactions_menu).action_unarchive()

    def _set_closed(self):
        """ Update the account's merchant status to 'closed'.

        All linked payment acquirers are also disabled to prevent any transaction to be made for
        this account. In practice, the proxy would prevent such transaction to reach Adyen's API.

        Note: self.ensure_one()

        :return: None
        """
        self.ensure_one()

        # Deactivate the account
        self.with_context(update_from_adyen=True).merchant_status = 'closed'

        # Disable all linked payment acquirers
        payment_acquirers = self.env['payment.acquirer'].search(
            [('provider', '=', 'odoo'), ('company_id', '=', self.company_id.id)]
        )
        if payment_acquirers:
            payment_acquirers.write({'state': 'disabled'})

    #=========== ANY METHOD BELOW THIS LINE HAS NOT BEEN CLEANED YET ===========#

    @api.constrains('phone_number')
    def _check_phone_number(self):
        """Verify phone number is valid for specified country."""
        for account in self:
            if not account.phone_number.startswith('+'):
                raise ValidationError(_("The provided phone number must be in international format"))
            phone_validation.phone_parse(
                account.phone_number,
                None  # Do not specify country code to force international format number
            )

    @api.constrains('phone_number')
    def _check_email(self):
        """Verify mail is valid (advanced check if flanker is installed)"""
        for account in self:
            if not mail_validation.mail_validate(account.email):
                raise ValidationError(_("The given email address is invalid: %s", account.email))

    @api.constrains('registration_number')
    def _check_vat(self):
        """Verify the given VAT is valid for specified country."""
        for account in self:
            if not account.env['res.partner'].simple_vat_check(
                account.country_id.code, account.registration_number
            ):
                raise ValidationError(
                    _("The given registration number is invalid: %s", account.registration_number)
                )

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)

        company_fields = {
            'country_id': 'country_id',
            'state_id': 'state_id',
            'city': 'city',
            'zip': 'zip',
            'street': 'street_name',  # base_address_extended
            'house_number_or_name': 'street_number',  # base_address_extended
            'email': 'email',
            'phone_number': 'phone',
        }
        if self.env.company.partner_id.is_company:
            company_fields.update({
                'registration_number': 'vat',
                'legal_business_name': 'name',
                'doing_business_as': 'name',
            })
            if 'entity_type' in fields_list:
                res['entity_type'] = 'business'

        field_keys = company_fields.keys() & set(fields_list)
        for field_name in field_keys:
            res[field_name] = self.env.company[company_fields[field_name]]

        if not self.env.company.partner_id.is_company and {'last_name', 'first_name'} & set(fields_list):
            name = self.env.company.partner_id.name.split()
            res['last_name'] = name[-1]
            res['first_name'] = ' '.join(name[:-1])

        return res

    def name_get(self):
        return [
            (record.id, "Odoo Payments Account" if record.id else "Odoo Payments Account Creation")
            for record in self
        ]

    @api.depends('company_id')  # fake 'depends' to be sure that this _compute method is called when the form view is displayed
    def _compute_need_to_provide_payment_journal(self):
        self.need_to_provide_payment_journal = self.env['ir.module.module'].sudo().search([
            ('name', '=', 'account_accountant'),
            ('state', '=', 'installed'),
        ])

    @api.depends('company_id')
    def _compute_payment_journal_id(self):
        for account in self:
            acquirer = self.env['payment.acquirer'].search([
                ('provider', '=', 'odoo'),
                ('company_id', '=', account.company_id.id),
            ], limit=1)
            account.payment_journal_id = acquirer.journal_id

    def _inverse_payment_journal_id(self):
        for account in self:
            acquirer = self.env['payment.acquirer'].search([
                ('provider', '=', 'odoo'),
                ('company_id', '=', account.company_id.id),
            ], limit=1)
            acquirer.journal_id = account.payment_journal_id

    @api.depends('merchant_status', 'kyc_state', 'transactions_count', 'adyen_kyc_ids', 'shareholder_ids', 'bank_account_ids')
    def _compute_onboarding_msg(self):
        self.onboarding_msg = False
        for account in self:
            if not account.id:
                continue
            if account.merchant_status == 'draft':
                continue
            elif account.merchant_status == 'pending':
                account.onboarding_msg = _(
                    "Our team will review your account. We will notify you, by email, as soon "
                    "as you can start processing payments."
                )
            elif account.merchant_status == 'active':
                if account.kyc_state == 'data_to_provide':
                    if account.transactions_count > 0:
                        data_to_fill_msgs = []

                        if len(account.adyen_kyc_ids) == 0:
                            data_to_fill_msgs.append(_("-   KYC: use 'Add a line' in the KYC tab to upload relevant document."))

                        if len(account.shareholder_ids) == 0:
                            data_to_fill_msgs.append(_(
                                "-   Shareholders: use 'Add a line' in the shareholder tab to list all your company "
                                "shareholders owning more than 25% of the company."
                            ))

                        if len(account.bank_account_ids) == 0:
                            data_to_fill_msgs.append(
                                _("-   Bank accounts: use 'Add a line' in the Bank accounts tab to a bank account.")
                            )

                        if data_to_fill_msgs:
                            account.onboarding_msg = _(
                                "In order to validate your account, you need to fill the following information:<br>"
                                "%s<br><br>"
                                "Then, click on 'save' and we will validate your information."
                            ) % ("<br>".join(data_to_fill_msgs))
                        else:
                            account.onboarding_msg = _(
                                "We will notify you via email when we have reviewed your information."
                            )
                elif account.kyc_state == 'validation':
                    account.onboarding_msg = _(
                        "We will notify you via email when we have reviewed your information."
                    )  # TODO ANVFE check if this message should be displayed (duplicate of the message above)
                elif account.kyc_state == 'validated':
                    if account.transactions_count == 0:
                        account.onboarding_msg = _(
                            "You can now receive payments.<br>After the first payment, we will notify "
                            "you to gather more data such as ID and banking details."
                        )
            elif account.merchant_status == 'closed':
                continue

    @api.depends('first_name', 'last_name', 'legal_business_name')
    def _compute_full_name(self):
        for account in self:
            if account.entity_type != 'individual':
                account.full_name = account.legal_business_name
            else:
                account.full_name = "%s %s" % (account.first_name, account.last_name)

    @api.depends('adyen_kyc_ids')
    def _compute_kyc_state(self):
        for account in self:
            if any(kyc.status == 'awaiting_data' for kyc in account.adyen_kyc_ids):
                account.kyc_state = 'data_to_provide'
            elif any(kyc.status == 'pending' for kyc in account.adyen_kyc_ids):
                account.kyc_state = 'validation'
            else:
                account.kyc_state = 'validated'

    @api.depends_context('lang')
    @api.depends('adyen_kyc_ids')
    def _compute_kyc_status(self):
        self.kyc_status_message = False
        doc_types = dict(self.env['adyen.kyc']._fields['verification_type']._description_selection(self.env))
        for account in self.filtered('adyen_kyc_ids.status_message'):
            checks = {}
            for kyc in account.adyen_kyc_ids.filtered('status_message'):
                doc_type = doc_types.get(kyc.verification_type, _('Other'))
                checks.setdefault(doc_type, []).append({
                    'document': kyc.document,
                    'message': kyc.status_message,
                })

            account.kyc_status_message = self.env['ir.qweb']._render(
                'odoo_payments.kyc_status_message', {
                    'checks': checks
                }
            )

    @api.onchange('country_id')
    def _onchange_country_id(self):
        """Reset state_id field when country is changed."""
        if self.state_id and self.state_id.country_id != self.country_id:
            self.state_id = False

    def write(self, vals):
        res = super().write(vals)

        if not self or self.env.context.get('update_from_adyen'):
            return res

        if len(self) > 1:
            raise UserError(_("Multi edit is not supported for Adyen Accounts"))

        if self.merchant_status == 'draft':
            # Do not try to update an account not created on Adyen side
            return res

        modified_fields = vals.keys()
        if any(getattr(self._fields[fname], 'sync_with_adyen', False) for fname in modified_fields):
            response = self._adyen_rpc('v1/update_account_holder', self._prepare_adyen_data())

            # FIXME ANVFE could be better if based on ACCOUNT_HOLDER_UPDATED notifications instead
            # "Requests using /updateAccountHolder are processed asynchronously."
            # "You'll receive a response to your API request, but you must rely on notification webhooks to know the final result of a request."
            self._handle_adyen_update_feedback(response)

        if 'payout_schedule' in vals and vals.get('payout_schedule') != self.payout_schedule:
            self._update_payout_schedule()

        return res

    def unlink(self):
        self.check_access_rights('unlink')

        # TODO ANVFE delete accounts on Adyen side *after* effective deletion on submerchant side (sql constraints, ...)
        # TODO ANVFE provide a button to close an account from submerchant side, instead of deleting the account record
        # TODO ANVFE catch close_account_holder request on Proxy, process on proxy & forward to internal as well?
        # TODO ANVFE better highlight/distinction between closed and non closed accounts
        for account in self:
            account._adyen_rpc('v1/close_account_holder', {
                'accountHolderCode': account.account_holder_code,
            })

        return super().unlink()

    def _handle_adyen_update_feedback(self, response):
        self.bank_account_ids._handle_adyen_update_feedback(response)
        self.shareholder_ids._handle_adyen_update_feedback(response)

    def _update_payout_schedule(self):
        self.ensure_one()

        self._adyen_rpc('v1/update_payout_schedule', {
            'accountCode': self.account_code,
            'metadata': {
                'adyen_uuid': self.adyen_uuid,
            },
            'payoutSchedule': {
                'action': 'UPDATE',
                'schedule': const.PAYOUT_SCHEDULE_MAPPING.get(self.payout_schedule),
            }
        })

    def action_show_transactions(self):
        """

        :rtype: dict
        """
        self.ensure_one()
        action = self.env['ir.actions.actions']._for_xml_id('odoo_payments.adyen_transaction_action')
        action['domain'] = expression.AND([[('adyen_account_id', '=', self.id)], literal_eval(action.get('domain', '[]'))])
        return action

    def action_show_payouts(self):
        """

        :rtype: dict
        """
        self.ensure_one()
        action = self.env['ir.actions.actions']._for_xml_id(
            'odoo_payments.action_view_adyen_transaction_payout'
        )
        action['domain'] = expression.AND([[('adyen_account_id', '=', self.id)], literal_eval(action.get('domain', '[]'))])
        return action

    def _upload_photo_id(self, document_type, content, filename):
        """

        :param document_type:
        :param content:
        :param filename:

        :return: None
        """
        self.ensure_one()
        # FIXME ANVFE wtf is this test mode config param ???
        test_mode = self.env['ir.config_parameter'].sudo().get_param('odoo_payments.test_mode')
        self._adyen_rpc('v1/upload_document', {
            'documentDetail': {
                'accountHolderCode': self.account_holder_code,
                'documentType': document_type,
                'filename': filename,
                'description': 'PASSED' if test_mode else '',
            },
            'documentContent': content.decode(),
        })

    def _get_creation_redirect_form(self):
        self.ensure_one()

        db_url = self.env.company.get_base_url()
        rendering_context = {
            'redirect_url': url_join(
                self.env['ir.config_parameter'].sudo().get_param('odoo_payments.merchant_url'),
                'create_submerchant',
            ),
            'db_url': db_url,
            'is_test': self.is_test,
            'return_url': url_join(db_url, OnboardingController._return_url),
            'adyen_data': json.dumps(self._prepare_adyen_data()),
        }
        return self.env.ref('odoo_payments.redirect_form')._render(rendering_context)

    def _prepare_adyen_data(self):
        """ Prepare expected payload for account holder creation/update routes

        https://docs.adyen.com/api-explorer/#/Account/v6/post/createAccountHolder
        https://docs.adyen.com/api-explorer/#/Account/v6/post/updateAccountHolder

        :returns: Payload for the createAccountHolder/updateAccountHolder Adyen routes
        :rtype: dict
        """
        return {
            'accountHolderCode': self.account_holder_code,
            'accountHolderDetails': self._prepare_account_holder_details(),
            # 'description': None,
            'legalEntity': const.LEGAL_ENTITY_TYPE_MAPPING[self.entity_type],
            # TODO 'primaryCurrency': None,
            # 'processingTier': --> Proxy
            # 'verificationProfile': None,
        }

    def _prepare_account_holder_details(self):
        sanitized_phone_number = phone_validation.phone_format(
            self.phone_number, None, None, force_format="E164")
        return {
            'address': {
                'city': self.city,
                'country': self.country_id.code,
                'houseNumberOrName': self.house_number_or_name,
                'postalCode': self.zip,
                'stateOrProvince': self.state_id.code or None,
                'street': self.street,
            },
            'bankAccountDetails': self.bank_account_ids._prepare_bank_account_details(),
            'businessDetails': self._prepare_business_details(),
            'email': self.email,
            # TODO make compute
            'fullPhoneNumber': sanitized_phone_number,
            'individualDetails': self._prepare_individual_details(),
            # TODO ?
            'legalArrangements': None,
            'merchantCategoryCode': None,
            'metadata': None,
            'payoutMethods': None,
            'principalBusinessAddress': None,
            'storeDetails': None,
            'webAddress': None,
        }

    def _prepare_business_details(self):
        if self.entity_type not in ('business', 'nonprofit'):
            return None  # Don't include the key in the payload
        else:
            return {
                'doingBusinessAs': self.doing_business_as,
                'legalBusinessName': self.legal_business_name,
                'registrationNumber': self.registration_number,
                'shareholders': self.shareholder_ids._prepare_shareholders_data(),
                # TODO store verificationProfile after acc creation
                #  and provide it for update requests ?
            }

    def _prepare_individual_details(self):
        if self.entity_type != 'individual':
            return None  # Don't include the key in the payload
        else:
            return {
                'name': {
                    'firstName': self.first_name,
                    'lastName': self.last_name,
                },
                'personalData': {
                    'dateOfBirth': str(self.date_of_birth),
                    'documentData': [
                        {
                            'number': self.document_number,
                            'type': self.document_type,
                        }
                    ] if self.document_number else [],
                }
            }

    def _handle_account_holder_status_change_notification(self, content):
        """

        Note: sudoed environment
        Note: self.ensure_one()

        """
        self.ensure_one()
        write_vals = {}

        # Tier
        tier = content.get('newStatus', {}).get('processingState', {}).get('tierNumber', None)
        if isinstance(tier, int) and tier != self.kyc_tier:
            write_vals['kyc_tier'] = tier

        # Payout
        payout_allowed = content.get('newStatus', {}).get('payoutState', {}).get('allowPayout', None)
        if payout_allowed is not None:
            write_vals['payout_allowed'] = payout_allowed == 'true'

        if write_vals:
            self.with_context(update_from_adyen=True).write(write_vals)

        # Events
        events = content.get('newStatus', {}).get('events')
        if events:
            reasons = []
            for event in events:
                account_event = event.get('AccountEvent', {}).get('reason')
                if account_event:
                    reasons.append(account_event)

            status_message = self.env['ir.qweb']._render('odoo_payments.status_message', {
                'message': content.get('reason'),
                'reasons': reasons,
            })
            self.message_post(body=status_message, subtype_xmlid="mail.mt_comment")

    def _handle_account_holder_verification_notification(self, content):
        """

        Note: sudoed environment
        Note: self.ensure_one()

        """
        self.ensure_one()

        status = const.KYC_STATUS_MAPPING.get(content.get('verificationStatus'))
        document = '_'.join(content.get('verificationType', '').lower().split('_')[:-1])  # bank_account, identity, passport, etc.
        status_message = content.get('statusSummary', {}).get('kycCheckDescription')

        bank_uuid = content.get('bankAccountUUID')
        shareholder_uuid = content.get('shareholderCode')

        kyc = self.adyen_kyc_ids.filtered(lambda k: k.verification_type == document)
        if bank_uuid:
            kyc = kyc.filtered(lambda k: k.bank_account_id.bank_account_uuid == bank_uuid or not k.bank_account_id)
        elif shareholder_uuid:
            kyc = kyc.filtered(lambda k: k.shareholder_id.shareholder_uuid == shareholder_uuid or not k.shareholder_id)
        else:
            kyc = kyc.filtered(lambda k: not k.shareholder_id and not k.bank_account_id)

        if not kyc:
            additional_data = {}
            if document == 'bank_account' and bank_uuid:
                bank_account = self.env['adyen.bank.account'].search([('bank_account_uuid', '=', bank_uuid)])
                additional_data['bank_account_id'] = bank_account.id
            if shareholder_uuid:
                shareholder = self.env['adyen.shareholder'].search([('shareholder_uuid', '=', shareholder_uuid)])
                additional_data['shareholder_id'] = shareholder.id

            self.env['adyen.kyc'].create({
                'verification_type': document,
                'adyen_account_id': self.id,
                'status': status,
                'status_message': status_message,
                'last_update': fields.Datetime.now(),
                **additional_data
            })
        else:
            # FIXME ANVFE SOMETIME kyc is a multi record recordset
            # and following lines raise.
            if bank_uuid and not kyc.bank_account_id:
                bank_account = self.env['adyen.bank.account'].search([('bank_account_uuid', '=', bank_uuid)])
                kyc.bank_account_id = bank_account.id
            if shareholder_uuid and not kyc.shareholder_id:
                shareholder = self.env['adyen.shareholder'].search([('shareholder_uuid', '=', shareholder_uuid)])
                kyc.shareholder_id = shareholder.id

            if status != kyc.status:
                kyc.write({
                    'status': status,
                    'status_message': status_message,
                    'last_update': fields.Datetime.now(),
                })

    def _handle_account_updated_notification(self, content):
        """

        Note: sudoed environment
        Note: self.ensure_one()

        """
        self.ensure_one()

        scheduled_date = content.get('payoutSchedule', {}).get('nextScheduledPayout')
        if scheduled_date:
            self.with_context(
                update_from_adyen=True
            ).next_scheduled_payout = parse(scheduled_date).astimezone(UTC).replace(tzinfo=None)

    def _handle_account_holder_payout_notification(self, content):
        """

        Note: sudoed environment
        Note: self.ensure_one()

        """
        self.ensure_one()
        status = content.get('status', {}).get('statusCode')

        if status == 'Failed':
            status_message = _('Failed payout: %s', content['status']['message']['text'])
            self.message_post(body=status_message, subtype_xmlid="mail.mt_comment")

    # FIXME ANVFE doesn't seem used
    def _fetch_transactions(self, page=1):
        self.ensure_one()
        response = self._adyen_rpc('v1/get_transactions', {
            'accountHolderCode': self.account_holder_code,
            'transactionListsPerAccount': [{
                'accountCode': self.account_code,
                'page': page,  # Each page lists up to 50 txs
            }],
            # transactionStatuses not provided to receive all adyen txs
        })
        transaction_list = response['accountTransactionLists'][0]
        return transaction_list['transactions'], transaction_list['hasNextPage']

    # Tooling #

    def _adyen_rpc(self, operation, adyen_data=None):
        """
        :param str operation: operation to request from Adyen
        :param dict adyen_data: payload

        :returns:
        """
        self.ensure_one()
        params = {
            'adyen_data': adyen_data or {},  # FIXME ANVFE do we ever reach adyen without any payload ?
            'adyen_uuid': self.adyen_uuid,
        }

        proxy_url = self.env['ir.config_parameter'].sudo().get_param('odoo_payments.proxy_url')
        request_url = url_join(proxy_url, operation)

        _logger.info("Sending data to %s:\n%s", request_url, pformat(params))

        payload = {
            'jsonrpc': '2.0',
            'params': params,
        }
        try:
            response = requests.post(
                request_url,
                json=payload,
                auth=AdyenProxyAuth(self),
                timeout=6000)  # TODO timeout=60
            response.raise_for_status()
        except requests.exceptions.Timeout:
            raise UserError(_('A timeout occurred while trying to reach the Adyen proxy.'))
        except Exception:
            raise UserError(_('The Adyen proxy is not reachable, please try again later.'))

        data = response.json()

        if 'error' in data:
            name = data['error']['data'].get('name').rpartition('.')[-1]
            if name == 'ValidationError':
                raise ValidationError(data['error']['data'].get('arguments')[0])
            else:
                _logger.warning('Proxy error: %s', data['error'])
                raise UserError(
                    _("We had troubles reaching Adyen, please retry later or contact the support if the problem persists"))
        return data.get('result')
