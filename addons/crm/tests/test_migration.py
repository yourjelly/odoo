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

        # 2. Schedule an Activity
        activity_form = Form(self.env['mail.activity'], view='calendar.mail_activity_view_form_popup')
        activity_form.activity_type_id=self.env['mail.activity.type'].search([], limit=1)
        activity_form.note = 'This is an activity'
        activity_form.res_model_id = self.env['ir.model']._get('crm.lead')
        activity_form.res_id = self.lead.id
        activity_form.date_deadline =  (datetime.now() + timedelta(days=1)).date()
        activity_form.user_id = self.crm_salesman
        activity = activity_form.save()

        # 3. Mark Lead as won
        wonlead_form = Form(self.lead, view='crm.crm_case_form_view_oppor')
        wonlead_form.stage_id = self.env['crm.stage'].search([('probability', '=', '100')], limit=1)
        wonlead = wonlead_form.save()
