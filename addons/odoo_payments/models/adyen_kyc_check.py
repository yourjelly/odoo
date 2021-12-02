# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

ADYEN_KYC_STATUS = [
    # Need a user action
    ('awaiting_data', "Data To Provide"),
    ('invalid_data', "Invalid Data"),
    ('failed', "Failed"),
    ('retry_limit_reached', "Maximum Retry Limit Reached"),
    # Final state or waiting for validation
    ('data_provided', "Data Provided"),
    ('pending', "Waiting For Validation"),
    ('passed', "Confirmed"),
]  # Ordered by display importance (desc) to always show the KYC check requiring an action


class AdyenKYCCheck(models.Model):
    _name = 'adyen.kyc.check'
    _description = "Adyen KYC Check"
    _order = 'write_date desc'

    adyen_account_id = fields.Many2one(
        comodel_name='adyen.account',
        required=True,
        ondelete='cascade',
    )
    check_type = fields.Selection(
        string="Type",
        selection=[
            ('company_verification', "Company"),
            ('card_verification', "Card"),
            ('identity_verification', "Identity"),
            ('legal_arrangement_verification', "Legal Arrangement"),
            ('nonprofit_verification', "Nonprofit"),
            ('passport_verification', "Passport"),
            ('payout_method_verification', "Payout Method"),
            ('pci_verification', "PCI"),
        ],
        required=True,
    )
    status = fields.Selection(string="Status", selection=ADYEN_KYC_STATUS, required=True)
    # https://docs.adyen.com/platforms/verification-process/verification-codes
    error_code = fields.Char(
        string="Error Code",
        help="The error code associated with the check failure.",
    )
    error_description = fields.Char(
        string="Description",
        help="The description associated with the error code",
    )

    # Linked records
    shareholder_code = fields.Char(string="Shareholder Code")
    shareholder_id = fields.Many2one(
        string="Linked Shareholder",
        comodel_name='adyen.shareholder',
        compute='_compute_shareholder_id',
    )
    shareholder_name = fields.Char(
        string="Shareholder",
        help="The shareholder on which this KYC check applies, if any.",
        related='shareholder_id.display_name',
    )

    #=========== ANY FIELD BELOW THIS LINE HAS NOT BEEN CLEANED YET ===========#

    # Linked Documents
    # legalArrangementCode = fields.Char()
    # legalArrangementEntityCode = fields.Char()
    payout_method_code = fields.Char(string="Bank Account UUID")
    # shareholderCode = fields.Char() --> shareholder_id
    # signatoryCode = fields.Char()

    bank_account_id = fields.Many2one(
        string="Bank Account",
        comodel_name='adyen.bank.account',
        compute='_compute_bank_account_id',
    )
    bank_account_name = fields.Char(
        related='bank_account_id.owner_name'
    )

    #=== COMPUTE METHODS ===#

    @api.depends('payout_method_code')
    def _compute_bank_account_id(self):
        self.bank_account_id = False
        for kyc_check in self.filtered('payout_method_code'):
            kyc_check.bank_account_id = kyc_check.adyen_account_id.bank_account_ids.filtered(
                lambda bank_account: bank_account.bank_account_uuid == kyc_check.payout_method_code
            )

    @api.depends('shareholder_code')
    def _compute_shareholder_id(self):
        self.shareholder_id = False
        for kyc_check in self.filtered('shareholder_code'):
            kyc_check.shareholder_id = kyc_check.adyen_account_id.shareholder_ids.filtered(
                lambda shareholder: shareholder.code == kyc_check.shareholder_code
            )

    #=== CONSTRAINT METHODS ===#

    #=== CRUD METHODS ===#

    #=== ACTION METHODS ===#

    #=== BUSINESS METHODS ===#

    #=== TOOLING ===#

    def _sort_by_status(self):
        """ Sort the KYC checks according to the status order.

        :return: The sorted recordset of KYC checks
        :rtype: recordset of `adyen.kyc.check`
        """
        status_order = [state[0] for state in ADYEN_KYC_STATUS]
        return self.sorted(key=lambda k: status_order.index(k.status))

    #=========== ANY METHOD BELOW THIS LINE HAS NOT BEEN CLEANED YET ===========#

    # @api.depends('bank_account_id', 'shareholder_id')
    # def _compute_document(self):
    #     self.document = False
    #     for kyc in self.filtered(lambda k: k.bank_account_id or k.shareholder_id):
    #         kyc.document = kyc.bank_account_id.display_name or kyc.shareholder_id.display_name
