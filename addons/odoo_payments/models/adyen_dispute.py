#
# # https://docs.adyen.com/risk-management/disputes-api
#
# from odoo import api, fields, models
#
# class AdyenDispute(models.Model):
#     _name = "adyen.dispute"
#     _description = "Adyen Dispute"
#
#     source_transaction_id = fields.Many2one('adyen.transaction', required=True)
#
#     psp_reference = fields.Char(required=True, index=True)
#
#     state_update_ids = fields.One2many("adyen.dispute.state.update", "dispute_id")
#
#     # TODO adyen dispute events
#     # or do it on a transaction directly since it's a 1:1 ?
#
#     #=== COMPUTE METHODS ===#
#
#     #=== CONSTRAINT METHODS ===#
#
#     #=== CRUD METHODS ===#
#
#     #=== ACTION METHODS ===#
#
#     #=== BUSINESS METHODS ===#
#
#     #=========== ANY METHOD BELOW THIS LINE HAS NOT BEEN CLEANED YET ===========#
#
#     def _fetch_defense_reasons(self):
#         # https://docs.adyen.com/risk-management/disputes-api#retrieve-applicable-defense-reasons
#         pass
#
#
# class AdyenDisputeStateUpdate(models.Model):
#     _name = "adyen.dispute.state.update"
#     _description = "Adyen Dispute State Update"
#
#     dispute_id = fields.Many2one("adyen.dispute", required=True)
#     # TODO ANVFE WHAT DO WE DO WITH NOTIFICATION OF FRAUD EVENTS ?
#     # THOSE ARE NOT REALLY DISPUTE REQUESTS
#     notification_type = fields.Selection([
#         ("REQUEST_FOR_INFORMATION", "Request for information"),
#         ("NOTIFICATION_OF_CHARGEBACK", "Pending Chargeback"),
#         ("CHARGEBACK", "Chargeback"),
#         ("CHARGEBACK_REVERSED", "Defended Chargeback"),
#         ("SECOND_CHARGEBACK", "Defense rejected"),
#         ("PREARBITRATION_WON", "Pre-Arbitration Won"),
#         ("PREARBITRATION_LOST", "Pre-Arbitration Lost"),
#     ])
#
# class AdyenDisputeDefenseReason(models.Model):
#     _name = "adyen.dispute.defense.reason"
#     _description = "Adyen Dispute Defense reason"
#
#     dispute_id = fields.Many2one("adyen.dispute", required=True)
#     code = fields.String()
#     satisfied = fields.Boolean(help="Sufficient defense material has been supplied")
#
# class AdyenDisputeDocument(models.Model):
#     _name = "adyen.dispute.defense.document"
#     _inherit = "Adyen Dispute Defense Document"
#
#     # M2O or M2M to defense reasons
#     # Do different defense reasons share document types on adyen side ???
#     provided = fields.Boolean() # aka available field on DefenseDocumentType model
#     document_type = fields.String()
#
#     requirementLevel = fields.Selection([
#         ("Required", "Fully required"),
#         ("OneOrMore", "One document required"),
#         ("Optional", "Optional"),
#         ("AlternativeRequired", "Generic defense document"),
#     ])
#
#     document = fields.Binary() # attachment True ? not sure