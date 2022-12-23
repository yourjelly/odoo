from odoo import fields, models


class L10nSaEdiMove(models.Model):
    _name = 'l10n_sa_edi.submission'
    _description = 'Saudi Submitted Move'
    _order = "l10n_sa_chain_index desc"

    l10n_sa_move_id = fields.Many2one("account.move", required=True)
    l10n_sa_journal_id = fields.Many2one("account.journal", related="l10n_sa_move_id.journal_id")
    l10n_sa_chain_index = fields.Integer("Submission Chain Index", required=True)
    l10n_sa_xml_content = fields.Binary("XML File", required=True)
    l10n_sa_status = fields.Selection([('rejected', 'Rejected'), ('accepted', 'Accepted')], required=True)
    l10n_sa_errors = fields.Text("Submission Errors")

