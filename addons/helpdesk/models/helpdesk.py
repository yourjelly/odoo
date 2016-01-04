# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime, timedelta
from openerp import SUPERUSER_ID
from openerp import api, fields, models, _
import openerp.addons.decimal_precision as dp
from openerp.exceptions import UserError
from openerp.tools import float_is_zero, float_compare, DEFAULT_SERVER_DATETIME_FORMAT


class HelpdeskTeam(models.Model):
    _name = "helpdesk.team"
    _inherit = ['mail.thread', 'ir.needaction_mixin']
    _description = "Helpdesk Team"
    _order = 'name'

    name = fields.Char(string='Helpdesk Team', required=True)
    active = fields.Boolean('Active', default=True)
    color = fields.Integer('Color Index')
    alias_id = fields.Many2one('mail.alias', string='Alias', ondelete="restrict", required=True)
    assign_method = fields.Selection([
        ('no', 'No assign'),
        ('manual', 'Manual assignation'),
        ('randomly', 'Randomly to Team'),
        ('least', 'Least charged'),
      ], string='Assignation Method', required=True, default='no')
    assign_responsible_ids = fields.Many2many('res.users', string='Team')
    ticket_count = fields.Integer('# Open Tickets')


class HelpdeskStage(models.Model):
    _name = 'helpdesk.stage'
    _description = 'Stage'
    _order = 'sequence'

    name = fields.Char(string='Helpdesk Stage', required=True)
    sequence = fields.Integer(string='Sequence', default=1)
    is_open = fields.Boolean(string='Active Stage', default=True)
    fold = fields.Boolean(string='Folded', default=False)

class HelpdeskType(models.Model):
    _name = 'helpdesk.type'
    _description = 'Ticket Type'
    _order = 'name'
    name = fields.Char(string='Ticket Type', required=True)

class HelpdeskTag(models.Model):
    _name = 'helpdesk.tag'
    _description = 'Tags'
    _order = 'name'

    name = fields.Char(string='Helpdesk Tag', required=True)
    color = fields.Integer('Color')

class HelpdeskTicket(models.Model):
    _name = 'helpdesk.ticket'
    _description = 'Ticket'
    _order = 'sequence, id desc'
    _inherit = ['mail.thread', 'ir.needaction_mixin', 'utm.mixin']
    _mail_mass_mailing = _('Tickets')

    @api.multi
    def _read_group_stage_ids(self, domain, read_group_order=None, access_rights_uid=None):
        """ Read group customization in order to display all the category in the
            kanban view, even if they are empty
        """
        stage_obj = self.env['helpdesk.stage']
        stage_ids = stage_obj._search([])
        result = stage_obj.name_get(stage_ids)
        fold = {}
        for stage in stage_obj.browse(stage_ids):
            fold[stage.id] = stage.fold
        return result, fold

    _group_by_full = {
        'stage_id': _read_group_stage_ids
    }


    name = fields.Char(string='Subject', required=True)
    sequence = fields.Integer(string='Sequence', default=1)

    team_id = fields.Many2one('helpdesk.team', string='Helpdesk Team', required=True, ondelete='cascade', index=True)
    note = fields.Text(string='Description')
    active = fields.Boolean('Active', default=True)

    type_id = fields.Many2one('helpdesk.type', string='Type')
    tag_ids = fields.Many2many('helpdesk.tag', string='Tags')
    company_id = fields.Many2one('res.company', string='Company')
    color = fields.Integer('Color Index')

    responsible_id = fields.Many2one('res.users', string='Assignee')
    partner_id = fields.Many2one('res.partner', string='Requester')

    stage = fields.Many2one('helpdesk.stage', 'Stage')
    priority = fields.selection([
            ('0', 'Low'),
            ('1', 'Normal'),
            ('2', 'High'),
            ('3', 'Urgent')
        ], string='Priority', default='1')

