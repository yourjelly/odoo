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
    _inherits = {'mail.alias': 'alias_id'}
    _description = "Helpdesk Team"
    _order = 'name'

    name = fields.Char(string='Helpdesk Team', required=True)
    active = fields.Boolean('Active', default=True)
    color = fields.Integer('Color Index')
    alias_id = fields.Many2one('mail.alias', string='Email', ondelete="restrict", required=False)
    assign_method = fields.Selection([
        ('no', 'No assign'),
        ('manual', 'Manual assignation'),
        ('randomly', 'Randomly to Team'),
        ('least', 'Least charged'),
      ], string='Assignation Method', required=True, default='no')
    assign_responsible_ids = fields.Many2many('res.users', string='Team')
    ticket_count = fields.Integer('# Open Tickets')

    feature_email = fields.Boolean('Email')
    feature_form = fields.Boolean('Website Form', compute="_module_website_installed")
    feature_livechat = fields.Boolean('Live chat',
        compute='_livechat_get', inverse='_livechat_set', store=True)
    feature_livechat_channel_id = fields.Many2one('im_livechat.channel', 'Live Chat Channel')
    feature_livechat_web_page = fields.Char(related='feature_livechat_channel_id.web_page', string='Live Chat Test Page', readonly=True)
    feature_twitter = fields.Boolean('Twitter')
    feature_api = fields.Boolean('API')

    feature_helpcenter = fields.Boolean('Help Center')
    feature_elearning = fields.Boolean('eLearning')

    feature_rating = fields.Boolean('Ratings')
    feature_sla = fields.Boolean('SLA Policies')

    feature_template = fields.Boolean('Email Templates')

    @api.model
    def create(self, vals):
        team = super(HelpdeskTeam, self.with_context(alias_model_name='helpdesk.ticket',
                                           mail_create_nolog=True,
                                           alias_parent_model_name=self._name)).create(vals)
        team.alias_id.write({'alias_parent_thread_id': team.id, "alias_defaults": {'team_id': team.id}})
        return team

    @api.one
    def _module_website_installed(self):
        module = self.env['ir.module.module'].search_browse([('name','=','helpdesk_website')])
        self.feature_form = bool(module and module[0].state in ('installed', 'to upgrade'))

    def _module_website_install(self):
        module = self.env['ir.module.module'].search_browse([('name','=','helpdesk_website')])
        if not module:
            raise UserError(_('Module helpdesk_website not found!'))
        module.button_install()

    @api.one
    @api.depends('feature_livechat_channel_id')
    def _livechat_instaled(self):
        self.feature_livechat = bool(self.feature_livechat_channel_id)

    def _livechat_set(self):
        if self.feature_livechat and not self.feature_livechat_channel_id:
            channel = self.env['im_livechat.channel'].create({
                'name': self.name,
            })
            channel.action_join()
            self.feature_livechat_channel_id = channel


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
        result = stage_obj.search([]).name_get()
        fold = {}
        for stage in stage_obj.search([]):
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

    responsible_id = fields.Many2one('res.users', string='Assignee', default=lambda self: self.env.uid)
    partner_id = fields.Many2one('res.partner', string='Requester')

    stage_id = fields.Many2one('helpdesk.stage', 'Stage')
    priority = fields.Selection([
            ('0', 'Low'),
            ('1', 'Normal'),
            ('2', 'High'),
            ('3', 'Urgent')
        ], string='Priority', default='1')

    @api.multi
    def name_get(self):
        result = []
        for ticket in self:
            result.append((ticket.id, "%s (#%d)" % (ticket.name, ticket.id)))
        return result

