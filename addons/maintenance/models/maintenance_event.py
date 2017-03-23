from odoo import api, fields, models


class MaintenanceAttendee(models.Model):
    _name = 'maintenance.attendee'
    _inherit = 'calendar.attendee'
    event_id = fields.Many2one('maintenance.event', 'Meeting linked', ondelete='cascade')

    # We override this method in order to don't send mail.
    @api.multi
    def _send_mail_to_attendees(self, template_xmlid, force_send=False):
        return True


class MaintenanceMeeting(models.Model):

    @api.model
    def _default_partners(self):
        """ When active_model is res.partner, the current partners should be attendees """
        return []

    """ Model for Maintenance Calendar Event """
    _name = 'maintenance.event'
    _inherit = 'calendar.event'

    maintenance_id = fields.One2many('maintenance.request', 'maintenance_event_id', string="Linked maintenance request", copy=False)
    description = fields.Text('Description', related='maintenance_id.description')
    owner_user_id = fields.Many2one('res.users', string='Created by', related='maintenance_id.owner_user_id')
    equipment_id = fields.Many2one('maintenance.equipment', string='Equipment', related='maintenance_id.equipment_id')
    category_id = fields.Many2one('maintenance.equipment.category', related='maintenance_id.category_id', string='Category', readonly=True)
    request_date = fields.Date('Request Date', related='maintenance_id.request_date')
    close_date = fields.Date('Close Date', help="Date the maintenance was finished.", related='maintenance_id.close_date')
    maintenance_type = fields.Selection([('corrective', 'Corrective'), ('preventive', 'Preventive')], related='maintenance_id.maintenance_type')
    maintenance_team_id = fields.Many2one('maintenance.team', related='maintenance_id.maintenance_team_id', required=True)
    technician_user_id = fields.Many2one('res.users', related='maintenance_id.technician_user_id')

    categ_ids = fields.Many2many('calendar.event.type', 'maintenance_category_rel', 'event_id', 'type_id', 'Tags')
    partner_ids = fields.Many2many('res.partner', 'maintenance_event_res_partner_rel', string='Attendees', copy=False)
    alarm_ids = fields.Many2many('calendar.alarm', 'calendar_alarm_maintenance_event_rel', string='Reminders', ondelete="restrict", copy=False)
    attendee_ids = fields.One2many('maintenance.attendee', 'event_id', 'Participant', ondelete='cascade', copy=False)

    # This method is used when you create a maintenance request directly from the maintenance event views
    @api.model
    def create(self, vals):
        maintenance_event = super(MaintenanceMeeting, self).create(vals)
        # Should not create if the maintenance request already exist or we specify that we won't create a new..
        if self.env.context.get('create_request', True):
            vals['maintenance_event_id'] = maintenance_event.id
            self.env['maintenance.request'].create(vals)
            # Remove the key to keep the behavior without copy
            if 'create_request' in self.env.context:
                del self.env.context['create_request']
        return maintenance_event
