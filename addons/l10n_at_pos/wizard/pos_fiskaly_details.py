from odoo import api, fields, models, _
from odoo.exceptions import UserError
from odoo.addons.l10n_at_pos.tools import at_fiskaly_services

class PosFiskalyDetailsWizard(models.TransientModel):
    _name = 'pos.fiskaly.details.wizard'
    _description = 'Point of Sale fiskaly Details Report'

    def _default_start_date(self):
        """ Find the earliest start_date of the latests sessions """
        # restrict to configs available to the user
        session_ids = self.env['pos.session'].search([]).ids
        # exclude configs has not been opened for 2 days
        self.env.cr.execute("""
            SELECT
            max(start_at) as start,
            config_id
            FROM pos_session
            WHERE config_id = ANY(%s)
            AND start_at > (NOW() - INTERVAL '2 DAYS')
            GROUP BY config_id
        """, (session_ids,))
        latest_start_dates = [res['start'] for res in self.env.cr.dictfetchall()]
        # earliest of the latest sessions
        return latest_start_dates and min(latest_start_dates) or fields.Datetime.now()

    start_date = fields.Datetime(required=True, default=_default_start_date)
    end_date = fields.Datetime(required=True, default=fields.Datetime.now)
    pos_session_ids = fields.Many2many('pos.session', 'pos_session_fiskaly_rel',
        default=lambda s: s.env['pos.session'].search([('l10n_at_pos_session_uuid', '!=', False)]))

    @api.onchange('start_date')
    def _onchange_start_date(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            self.end_date = self.start_date

    @api.onchange('end_date')
    def _onchange_end_date(self):
        if self.end_date and self.start_date and self.end_date < self.start_date:
            self.start_date = self.end_date

    def action_dep_audit_report(self):
        start_duration = int(self.start_date.timestamp())
        end_duration = int(self.end_date.timestamp())
        if end_duration-start_duration < 0:
            raise UserError(_("Invalid date selection end date must be after the start date"))
        elif end_duration-start_duration > 0:
            return at_fiskaly_services.session_dep_report(self.pos_session_ids, start_duration, end_duration)
