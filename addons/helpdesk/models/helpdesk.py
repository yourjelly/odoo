# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime, timedelta
from dateutil import relativedelta
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
    alias_id = fields.Many2one('mail.alias', string='Email', ondelete="restrict", required=True)
    assign_method = fields.Selection([
        ('no', 'No assign'),
        ('manual', 'Manual assignation'),
        ('randomly', 'Randomly to Team'),
        ('least', 'Least charged'),
      ], string='Assignation Method', required=True, default='no')
    assign_responsible_ids = fields.Many2many('res.users', string='Team')
    ticket_count = fields.Integer('# Open Tickets')

    feature_email = fields.Boolean('Email')
    feature_form = fields.Boolean('Website Form', compute="_module_website_installed", inverse="_module_website_install")
    feature_form_url = fields.Char('URL to Submit Issue', readonly=True, compute='_get_form_url')
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

    # Feature Fields  Compute
    @api.one
    @api.depends('feature_form')
    def _get_form_url(self):
        self.feature_form_url = (self.feature_form and self.id) and ('/website/helpdesk/'+str(self.id)+'/submit') or False

    @api.one
    def _module_twitter_installed(self):
        module = self.env['ir.module.module'].search([('name','=','mail_channel_twitter')])
        self.feature_twitter = bool(module and module[0].state in ('installed', 'to upgrade'))

    def _module_twitter_install(self):
        if self.feature_twitter:
            module = self.env['ir.module.module'].search([('name','=','mail_channel_twitter')])
            if not module:
                raise UserError(_('Module mail_channel_twitter not found!'))
            module.button_install()
            # Todo: create a channel and connect twitter

    @api.one
    def _module_website_installed(self):
        module = self.env['ir.module.module'].search([('name','=','helpdesk_website')])
        self.feature_form = bool(module and module[0].state in ('installed', 'to upgrade'))

    def _module_website_install(self):
        if self.feature_form:
            module = self.env['ir.module.module'].search([('name','=','helpdesk_website')])
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

    # Object methods
    @api.model
    def create(self, vals):
        print 'ICI', vals.get('feature_email', False), vals.get('alias_name', False)
        team = super(HelpdeskTeam, self.with_context(alias_model_name='helpdesk.ticket',
                                           mail_create_nolog=True,
                                           alias_parent_model_name=self._name)).create(vals)
        #team = super(HelpdeskTeam, self.with_context(alias_model_name='helpdesk.ticket',
        #                                   mail_create_nolog=True,
        #                                   alias_parent_model_name=self._name)).create(vals)
        print 'LA'
        if team.alias_id:
            team.alias_id.write({'alias_parent_thread_id': team.id, "alias_defaults": {'team_id': team.id}})
        return team


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

class HelpdeskSLA(models.Model):
    _name = "helpdesk.sla"
    _order = "sequence, name"
    _description = "Helpdesk SLA Policies"

    name = fields.Char('SLA Policy Name', required=True, index=True)
    sequence = fields.Integer('Sequence', default=1, index=True)
    note = fields.Text('SLA Policy Description')
    active = fields.Boolean('Active', default=True)
    condition_team_id = fields.Many2one('helpdesk.team', string='Team', required=True)
    condition_type_id = fields.Many2one('helpdesk.type', string='Type')
    condition_stage_id = fields.Many2one('helpdesk.stage', string='Stage', required=True)
    condition_priority = fields.Selection([
        ('0', 'All'),
        ('1', 'All but low priorities'),
        ('2', 'High & Urgent'),
        ('3', 'Urgent Only'),
    ], string='Priority', required=True, default='0')

    time_days = fields.Integer('Time to Assign')
    time_hours = fields.Integer('Time since Creation')
    time_minutes = fields.Integer('Time to First Answer')

class HelpdeskTicket(models.Model):
    _name = 'helpdesk.ticket'
    _description = 'Ticket'
    _order = 'sequence, id desc'
    _inherit = ['mail.thread', 'ir.needaction_mixin', 'utm.mixin']
    _mail_mass_mailing = _('Tickets')

    @api.model
    def _default_stage_id(self):
        stages = self.env['helpdesk.stage'].search([], limit=1)
        return stages and stages.id or False

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

    name = fields.Char(string='Subject', required=True, index=True)
    sequence = fields.Integer(string='Sequence', default=1, index=True)

    team_id = fields.Many2one('helpdesk.team', string='Helpdesk Team', required=True, ondelete='cascade', index=True)
    note = fields.Text(string='Description')
    active = fields.Boolean('Active', default=True)

    type_id = fields.Many2one('helpdesk.type', string='Type')
    tag_ids = fields.Many2many('helpdesk.tag', string='Tags')
    sla_ids = fields.Many2many('helpdesk.sla', string='SLA Policies')
    company_id = fields.Many2one('res.company', string='Company')
    color = fields.Integer('Color Index')

    responsible_id = fields.Many2one('res.users', string='Assignee', default=lambda self: self.env.uid)
    partner_id = fields.Many2one('res.partner', string='Requester')

    # Used to submit tickets from a contact form
    partner_name = fields.Char(string='Requester Name', related="partner_id.name") #inverse="_set_partner_id") ???
    partner_email = fields.Char(string='Requester Email', related="partner_id.email") #inverse="_set_partner_id") ???

    stage_id = fields.Many2one('helpdesk.stage', 'Stage', default=_default_stage_id)
    last_stage_update = fields.Datetime('Last Stage update')
    priority = fields.Selection([
            ('0', 'Low'),
            ('1', 'Normal'),
            ('2', 'High'),
            ('3', 'Urgent')
        ], string='Priority', default='1')

    sla_id = fields.Many2one('helpdesk.sla', string='Failed SLA Policy ID', compute='_get_sla_id')
    sla_name = fields.Char(string='Failed SLA Policy', compute='_get_sla_id')

    @api.multi
    def name_get(self):
        result = []
        for ticket in self:
            result.append((ticket.id, "%s (#%d)" % (ticket.name, ticket.id)))
        return result

    @api.one
    @api.depends('team_id','stage_id','priority','type_id')
    def _get_sla_id(self):
        dom = [('condition_team_id','=',self.team_id.id), ('condition_priority','<=', self.priority)]
        if self.type_id: 
            dom.append('|', ('condition_type_id','=',False), ('condition_type_id','=',self.type_id.id))
        if self.stage_id: 
            dom.append(('condition_stage_id.sequence','>=',self.stage_id.sequence))
        for sla in self.env['helpdesk.sla'].search(dom):
            dt = self.last_stage_update or datetime.today()
            dt = dt - relativedelta.relativedelta(days=sla.time_days, hours=sla.time_hours, minutes=sla.time_minutes)
            if self.active and (self.create_date < dt.strftime('%Y-%m-%d %H:%M:%S')):
                self.sla_id = sla
                self.sla_name = sla.name
                return
        self.sla_id = False
        self.sla_name = False

