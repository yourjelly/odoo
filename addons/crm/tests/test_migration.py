# -*- coding: utf-8 -*-

from odoo.tests import tagged, Form
from odoo.tests.common import TransactionCase
from datetime import datetime, timedelta

@tagged('-standard','migration','post_install')
class MigTestCrm(TransactionCase):

    def setUp(self):
        super(MigTestCrm, self).setUp()

        # Create a partner
        self.crm_partner = self.env['res.partner'].create({
            'name': 'Jack Snipe',
            'email': 'jack.snipe@migration.com',
            'country_id': self.env.ref("base.main_company").country_id.id
        })

        # Create a user as 'Crm Salesman' and add group_partner_manager
        self.crm_salesman = self.env['res.users'].create({
            'company_id': self.env.ref("base.main_company").id,
            'name' : "Lucy Warbler",
            'login': "LucyWarbler",
            'email': "lucy.warbler@birdcompany.com",
            'notification_type': 'inbox',
            'groups_id': [(6, 0, [self.env.ref('base.group_partner_manager').id])]
        })


    def test_migration(self):
        # 1. Create a Lead
        lead_form = Form(self.env['crm.lead'], view='crm.crm_case_form_view_oppor')
        lead_form.name = 'Test lead'
        lead_form.partner_id = self.crm_partner
        lead_form.description = 'This is the description of the Test lead.'
        lead_form.team_id =self.env['crm.team']._get_default_team_id(user_id=self.crm_salesman.user_id.id)
        lead_form.user_id = self.crm_salesman
        self.lead = lead_form.save()

        # 2. Schedule a Call and Meeting
        lead_model_id = self.env['ir.model']._get('crm.lead')

        # 2.1 Call
        call_form = Form(self.env['mail.activity'], view='calendar.mail_activity_view_form_popup')
        call_form.activity_type_id=self.env['mail.activity.type'].search([('name', '=', 'Call')], limit=1)
        call_form.note = 'This is a call activity'
        call_form.res_model_id = lead_model_id
        call_form.res_id = self.lead.id
        call_form.date_deadline =  (datetime.now() + timedelta(days=1)).date()
        call_form.user_id = self.crm_salesman
        call = call_form.save()

        # 2.2 Meeting
        meeting_form = Form(self.env['mail.activity'], view='calendar.mail_activity_view_form_popup')
        meeting_form.activity_type_id=self.env['mail.activity.type'].search([('name', '=', 'Meeting')], limit=1)
        meeting_form.note = 'This is a meeting activity'
        meeting_form.res_model_id = lead_model_id
        meeting_form.res_id = self.lead.id
        meeting_form.date_deadline = (datetime.now() + timedelta(days=1)).date()
        meeting_form.user_id = self.crm_salesman
        meeting = meeting_form.save()

        # 3. Mark Lead as won
        wonlead_form = Form(self.lead, view='crm.crm_case_form_view_oppor')
        wonlead_form.stage_id = self.env['crm.stage'].search([('name', '=', 'Won')], limit=1)
        wonlead = wonlead_form.save()


