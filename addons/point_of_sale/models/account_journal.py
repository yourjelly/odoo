# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# Copyright (C) 2004-2008 PC Solutions (<http://pcsol.be>). All Rights Reserved
from odoo import fields, models, api, _
from odoo.exceptions import UserError


class AccountJournal(models.Model):
    _inherit = 'account.journal'

    journal_user = fields.Boolean('Use in Point of Sale',
        help="Check this box if this journal define a payment method that can be used in a point of sale.")
    amount_authorized_diff = fields.Float('Amount Authorized Difference',
        help="This field depicts the maximum difference allowed between the ending balance and the theoretical cash when "
             "closing a session, for non-POS managers. If this maximum is reached, the user will have an error message at "
             "the closing of his session saying that he needs to contact his manager.")

    @api.model
    def _search(self, args, offset=0, limit=None, order=None, count=False, access_rights_uid=None):
        session_id = self.env.context.get('pos_session_id', False)
        if session_id:
            session = self.env['pos.session'].browse(session_id)
            if session:
                args += [('id', 'in', session.config_id.journal_ids.ids)]
        return super(AccountJournal, self)._search(args=args, offset=offset, limit=limit, order=order, count=count, access_rights_uid=access_rights_uid)

    @api.onchange('type')
    def onchange_type(self):
        if self.type not in ['bank', 'cash']:
            self.journal_user = False

    @api.multi
    def write(self, vals):
        if vals.get('active', False):
            config_ids = self.env['pos.config'].search([
                '|',
                    ('journal_id', 'in', self.ids),
                    ('journal_ids', 'in', self.ids)
            ]).ids
            if config_ids:
                running_sessions = self.env['pos.session'].search([
                    ('state', '!=', 'closed'),
                    ('config_id', 'in', config_ids)
                ])
                if running_sessions:
                    journals = running_sessions.mapped('config_id.journal_id')
                    journals |= running_sessions.mapped('config_id.journal_ids')
                    journals = journals & self
                    raise UserError(
                        _("You can not archive the journal %s as it is still used in the PoS sessions %s.")
                        % (', '.join(journal.name for journal in journals),
                           ', '.join(session.name for session in open_sessions))
                    )
        return super(AccountJournal, self).write(vals)

    @api.multi
    def unlink(self):
        for journal in self:
            pos_session_ids = self.env['pos.session'].search([('state', '!=', 'closed'), '|', ('config_id.journal_id', '=', journal.id), ('config_id.journal_ids', 'in', journal.id)]).ids
            if len(pos_session_ids):
                raise UserError(_("You cannot delete Journals that are used by active PoS sessions.\n")\
                        + _("Journal: ") + str(journal.id) +"\n"\
                        + _("PoS Sessions: ") + ', '.join(str(pos_session_id) for pos_session_id in pos_session_ids))
        return super(AccountJournal, self).unlink()
