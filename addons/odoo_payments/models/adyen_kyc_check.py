# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models

ADYEN_KYC_STATUS = [
    ('awaiting_data', "Data To Provide"),
    ('data_provided', "Data Provided"),
    ('pending', "Waiting For Validation"),
    ('invalid_data', "Invalid Data"),
    ('passed', "Confirmed"),
    ('failed', "Failed"),
    ('retry_limit_reached', "Maximum Retry Limit Reached"),
]


class AdyenKYCCheck(models.Model):
    _name = 'adyen.kyc.check'
    _description = "Adyen KYC Check"

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
    shareholder_id = fields.Many2one(
        string="Linked Shareholder",
        comodel_name='adyen.shareholder',
        ondelete='cascade',
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
    # payoutMethodCode = fields.Char()
    # shareholderCode = fields.Char() --> shareholder_id
    # signatoryCode = fields.Char()

    # Became payout method in adyen api ???
    # bank_account_id = fields.Many2one(
    #     comodel_name='adyen.bank.account',
    #     domain="[('adyen_account_id', '=', adyen_account_id)]",
    #     ondelete='cascade')

    #=== COMPUTE METHODS ===#

    #=== CONSTRAINT METHODS ===#

    #=== CRUD METHODS ===#

    #=== ACTION METHODS ===#

    #=== BUSINESS METHODS ===#

    #=========== ANY METHOD BELOW THIS LINE HAS NOT BEEN CLEANED YET ===========#

    # def _sort_by_status(self):
    #     order = ['failed', 'awaiting_data', 'pending', 'data_provided', 'passed']
    #     kyc_sorted = sorted(self, key=lambda k: order.index(k.status))
    #     return kyc_sorted

    # @api.depends('bank_account_id', 'shareholder_id')
    # def _compute_document(self):
    #     self.document = False
    #     for kyc in self.filtered(lambda k: k.bank_account_id or k.shareholder_id):
    #         kyc.document = kyc.bank_account_id.display_name or kyc.shareholder_id.display_name
