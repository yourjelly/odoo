from odoo import api, fields, models


class AccountReportClosingType(models.Model):
    _name = "account.report.closing.type"
    _description = "Closing Type"

    name = fields.Char(string="Name", required=True)
    tax_ids = fields.One2many(string="Taxes", comodel_name='account.tax', inverse_name='closing_type_id')
    report_ids = fields.Many2many(string="Reports", comodel_name='account.report')
    move_generator_code = fields.Char(string="Entry Generator")
    lock_type = fields.Selection(string="Lock", selection=[('none', "None"), ('entries', "Entries"), ('taxes', "Taxes")], required=True)

    # TODO OCO problème pour les droits d'accès: si l'advisor et l'accountant doivent pouvoir faire la tax closing, c'est pas le cas  de  la générale, si ? => un champ sur le closing type pour dire advisor_only ?

    #TODO OCO pour le cas de l'EC Sales List à rendre avec le tax report belge ; on pourrait peut-être plutôt s'en sortir avec une section optionnelle sur le rapport de taxes, et une closing liée juste à ce rapport
    periodicity = fields.Selection(
        string="Periodicity",
        selection=[
            ('year', 'Annually'),
            ('semester', 'Semi-annually'),
            ('4_months', 'Every 4 months'),
            ('trimester', 'Quarterly'),
            ('2_months', 'Every 2 months'),
            ('monthly', 'Monthly'),
        ], #TODO OCO renommer les labels techniques, ce serait pas mal, je pense... c'est super incohérent
        company_dependent=True,
        required=True,
    )

    tax_closing_payable_account_id = fields.Many2one(string="Tax Payable Account", comodel_name='account.account', company_dependent=True, required=True)
    tax_closing_receivable_account_id = fields.Many2one(string="Tax Receivable Account", comodel_name='account.account', company_dependent=True, required=True)
    tax_closing_journal_id = fields.Many2one(string="Tax Closing Journal", comodel_name='account.journal', company_dependent=True, required=True)



    #TODO OCO pour les trucs comme l'EDI FR, on pourrait avoir un champ property sur les closings

    # TODO OCO si on mettait un champ active company_dependent à True par défaut ? (ça marche ?) comme ça, pas obligé d'utiliser chaque closing type partout

    @api.model_create_multi
    def create(self, vals_list):
        rslt = super().create(vals_list)
        for closing_type in rslt:
            self.env['ir.property']._set_default('periodicity', 'account.report.closing.type', closing_type.periodicity, res_id=closing_type.id) #TODO OCO à tester, mais ça devrait le faire
        return rslt


class AccountReportClosing(models.Model):
    _name = "account.report.closing"
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _description = "Closing"
    _check_company_auto = True

    name = fields.Char(string="Name", required=True)
    closing_type_id = fields.Many2one(string="Type", comodel_name='account.report.closing.type', required=True)
    date = fields.Date(string="Date", required=True)
    journal_lock_ids = fields.One2many(string="Journal Locks", comodel_name='account.report.closing.journal.lock', inverse_name='closing_id')
    move_ids = fields.One2many(string="Closing Moves", comodel_name='account.move', inverse_name='report_closing_id') #TODO OCO du coup, empêcher l'édition de ces moves semble indiqué
    move_count = fields.Integer(compute='_compute_move_count')
    state = fields.Selection(string="State", selection=[('in_progress', "In Progress"), ('closed', "Closed")], required=True, default='in_progress')
    notes = fields.Html(string="Notes") #TODO OCO on pourrait lui mettre une valeur par défaut set sur le closing type; peut-être too much, mais pas sûr; ce sont des flux cycliques
    company_ids = fields.Many2many(string="Companies", comodel_name='res.company', required=True) #TODO OCO vérifier que check_company_auto comprend ça
    main_company_id = fields.Many2one(string="Main Company", comodel_name='res.company', required=True)
    # TOCO OCO pour que chaque membre de la closing ait possibilité de set un tax lock date avant que la mère ne close, que faire ? m2m cochable ? Champ property à set chacune ? Rien et osef ? => garder le bouton pour poster l'entrée, la poster et tout déduire de son état  ? ==> mais alors, comment on connaît la mère ? Comment on gère le posting intermédiaire ? :/ => un champ main_company_id en plus ?
    move_generator_code = fields.Char(related='closing_type_id.move_generator_code')
    lock_type = fields.Selection(related='closing_type_id.lock_type')

    @api.depends('move_ids')
    def _compute_move_count(self):
        for record in self:
            record.move_count = len(record.move_ids)


class AccountReportClosingJournalLock(models.Model):
    _name = "account.report.closing.journal.lock"
    _description = "Closing Journal Lock"
    _check_company_auto = True

    company_id = fields.Many2one(comodel_name='res.company', required=True)
    journal_id = fields.Many2one(comodel_name='account.journal', required=True)
    closing_id = fields.Many2one(comodel_name='account.report.closing', required=True)
