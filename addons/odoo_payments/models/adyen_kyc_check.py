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
    shareholder_id = fields.Many2one(comodel_name='adyen.shareholder', ondelete='cascade')

    #=========== ANY FIELD BELOW THIS LINE HAS NOT BEEN CLEANED YET ===========#

    # code = fields.Char(string="Code")
    # description = fields.Char(string="Description")

    # Linked Documents
    # legalArrangementCode = fields.Char()
    # legalArrangementEntityCode = fields.Char()
    # payoutMethodCode = fields.Char()
    # shareholderCode = fields.Char() --> shareholder_id
    # signatoryCode = fields.Char()

    # bank_account_id = fields.Many2one(
    #     comodel_name='adyen.bank.account',
    #     domain="[('adyen_account_id', '=', adyen_account_id)]",
    #     ondelete='cascade')
    # shareholder_id = fields.Many2one(
    #     comodel_name='adyen.shareholder',
    #     domain="[('adyen_account_id', '=', adyen_account_id)]",
    #     ondelete='cascade')
    # document = fields.Char(compute='_compute_document', help="Linked document name")
    document = fields.Char(default="TODO", help="Linked document name")

    # last_update = fields.Datetime(string="Last Update")

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
