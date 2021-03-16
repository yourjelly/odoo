# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.crm.tests.common import TestLeadConvertMassCommon
from odoo.fields import Datetime
from odoo.tests.common import tagged, users


@tagged('lead_manage')
class TestLeadMerge(TestLeadConvertMassCommon):
    """ During a mixed merge (involving leads and opps), data should be handled a certain way following their type
    (m2o, m2m, text, ...). """

    @classmethod
    def setUpClass(cls):
        super(TestLeadMerge, cls).setUpClass()
        print(" cls.lead_w_partner.........", cls.lead_w_partner)
        cls.leads = cls.lead_1 + cls.lead_w_partner + cls.lead_w_contact + cls.lead_w_email + cls.lead_w_partner_company + cls.lead_w_email_lost
        # reset some assigned users to test salesmen assign
        (cls.lead_w_partner | cls.lead_w_email_lost).write({
            'user_id': False,
        })
        cls.lead_w_partner.write({'stage_id': False})

        cls.lead_w_contact.write({'description': 'lead_w_contact'})
        cls.lead_w_email.write({'description': 'lead_w_email'})
        cls.lead_1.write({'description': 'lead_1'})
        cls.lead_w_partner.write({'description': 'lead_w_partner'})

        cls.assign_users = cls.user_sales_manager + cls.user_sales_leads_convert + cls.user_sales_salesman

        cls.activity_type_1 = cls.env['mail.activity.type'].create({
            'name': 'Activity 1',
            'delay_count': 5,
            'summary': 'ACT 1 : Presentation, barbecue, ... ',
            'res_model_id': cls.env['ir.model']._get('crm.lead').id,
        })
        print(" cls.activity_type_1///////////////////", cls.activity_type_1)

    def test_initial_data(self):
        """ Ensure initial data to avoid spaghetti test update afterwards """

        self.assertFalse(self.lead_1.date_conversion)
        self.assertEqual(self.lead_1.date_open, Datetime.from_string('2020-01-15 11:30:00'))
        self.assertEqual(self.lead_1.user_id, self.user_sales_leads)
        self.assertEqual(self.lead_1.team_id, self.sales_team_1)
        self.assertEqual(self.lead_1.stage_id, self.stage_team1_1)

        self.assertEqual(self.lead_w_partner.stage_id, self.env['crm.stage'])
        self.assertEqual(self.lead_w_partner.user_id, self.env['res.users'])
        self.assertEqual(self.lead_w_partner.team_id, self.sales_team_1)

        self.assertEqual(self.lead_w_partner_company.stage_id, self.stage_team1_1)
        self.assertEqual(self.lead_w_partner_company.user_id, self.user_sales_manager)
        self.assertEqual(self.lead_w_partner_company.team_id, self.sales_team_1)

        self.assertEqual(self.lead_w_contact.stage_id, self.stage_gen_1)
        self.assertEqual(self.lead_w_contact.user_id, self.user_sales_salesman)
        self.assertEqual(self.lead_w_contact.team_id, self.sales_team_convert)

        self.assertEqual(self.lead_w_email.stage_id, self.stage_gen_1)
        self.assertEqual(self.lead_w_email.user_id, self.user_sales_salesman)
        self.assertEqual(self.lead_w_email.team_id, self.sales_team_convert)

        self.assertEqual(self.lead_w_email_lost.stage_id, self.stage_team1_2)
        self.assertEqual(self.lead_w_email_lost.user_id, self.env['res.users'])
        self.assertEqual(self.lead_w_email_lost.team_id, self.sales_team_1)

    @users('user_sales_manager')
    def test_lead_merge_internals(self):
        """ Test internals of merge wizard. In this test leads are ordered as

        lead_w_contact --lead---seq=30
        lead_w_email ----lead---seq=3
        lead_1 ----------lead---seq=1
        lead_w_partner --lead---seq=False
        """
        # ensure initial data
        self.lead_w_partner_company.action_set_won()  # won opps should be excluded

        merge = self.env['crm.merge.opportunity'].with_context({
            'active_model': 'crm.lead',
            'active_ids': self.leads.ids,
            'active_id': False,
        }).create({
            'user_id': self.user_sales_leads_convert.id,
        })
        self.assertEqual(merge.team_id, self.sales_team_convert)

        # TDE FIXME: not sure the browse in default get of wizard intended to exlude lost, as it browse ids
        # and exclude inactive leads, but that's not written anywhere ... intended ??
        self.assertEqual(merge.opportunity_ids, self.leads - self.lead_w_partner_company - self.lead_w_email_lost)
        ordered_merge = self.lead_w_contact + self.lead_w_email + self.lead_1 + self.lead_w_partner
        ordered_merge_description = '\n\n'.join(l.description for l in ordered_merge)

        # merged opportunity: in this test, all input are leads. Confidence is based on stage
        # sequence -> lead_w_contact has a stage sequence of 30
        result = merge.action_merge()

        merge_opportunity = self.env['crm.lead'].browse(result['res_id'])
        self.assertFalse((ordered_merge - merge_opportunity).exists())
        self.assertEqual(merge_opportunity, self.lead_w_contact)
        self.assertEqual(merge_opportunity.type, 'lead')
        self.assertEqual(merge_opportunity.description, ordered_merge_description)
        # merged opportunity has updated salesman / team / stage is ok as generic
        self.assertEqual(merge_opportunity.user_id, self.user_sales_leads_convert)
        self.assertEqual(merge_opportunity.team_id, self.sales_team_convert)
        self.assertEqual(merge_opportunity.stage_id, self.stage_gen_1)

    @users('user_sales_manager')
    def test_lead_merge_activities(self):
        """ Test if acitivies scheduled for leads are not lost while merging leads.
            In this test leads are ordered as
            lead_1 --- has an activity associated with it
            lead_w_partner -- no activity -- stage_id = False
            lead_w_partner_company -- no activity
        """

        lead_model_id = self.env['ir.model']._get('crm.lead').id
        activity = self.env['mail.activity'].with_user(self.user_sales_manager).create({
            'activity_type_id': self.activity_type_1.id,
            'summary': 'My Own Summary',
            'res_id': self.lead_1.id,
            'res_model_id': lead_model_id,
        })
        self.leads  = self.leads - self.lead_w_email_lost - self.lead_w_contact - self.lead_w_email
        self.lead_1.write({'activity_ids': activity,'stage_id': self.stage_team1_1.id})
        leads = self.env['crm.lead'].browse(self.leads.ids)._sort_by_confidence_level(reverse=True)

        with self.assertLeadMerged(self.lead_1, leads,
                                   name='Nibbler Spacecraft Request',
                                   contact_name='Amy Wong',
                                   ):
            leads._merge_opportunity(auto_unlink=False, max_length=None)

    @users('user_sales_manager')
    def test_lead_merge_calender_meetings(self):

        print("@@@@@@@@@@@@@@@@@@test_lead_merge_calender_meetings@@@@@@@@@@@@@@@@@@@@@@@@@@@")
        lead_model_id = self.env['ir.model']._get('crm.lead').id
        activty_type = self.env['mail.activity.type'].create({
            'name': 'Meeting',
            'category': 'meeting'
        })
        self.leads = self.leads - self.lead_w_email_lost - self.lead_w_contact - self.lead_w_email
        activity_id = self.env['mail.activity'].create({
            'summary': 'Meeting with partner',
            'activity_type_id': activty_type.id,
            'res_model_id': lead_model_id,
            'res_id': self.lead_1.id,
        })

        calendar_event = self.env['calendar.event'].create({
            'name': 'Meeting with partner',
            'activity_ids': [(6, False, activity_id.ids)],
            'start': '2018-11-12 21:00:00',
            'stop': '2018-11-13 00:00:00',
        })
        self.lead_1.write({'type': 'opportunity','activity_ids':activity_id})
        print("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$")
        print("lead",self.lead_1)
        print("activty",activity_id)
        print("calendre",calendar_event)
        # self.assertEqual(calendar_event.name, activity_id.summary)
        # self.assertEqual(self.lead_1.calendar_event.id, calendar_event.id)
        merge = self.env['crm.merge.opportunity'].with_context({
            'active_model': 'crm.lead',
            'active_ids': self.leads.ids,
            'active_id': False,
        }).create({'team_id': self.sales_team_convert.id,
            'user_id': False,
        })
        print("merge",merge)
        print("merge opp ids..",merge.opportunity_ids)
        for id in merge.opportunity_ids:
            print("",id.name)
        result = merge.action_merge()
        merge_opportunity = self.env['crm.lead'].browse(result['res_id'])
        print("merge oppp.........",merge_opportunity)
        # print("merge_opportunity.activity_id.",merge_opportunity)
        self.assertEqual(merge_opportunity, self.lead_1)
        print(" calender activty of merged opp.....",merge_opportunity.activity_ids)
        print(" calender activty of merged opp.....",merge_opportunity.calender_event_id)

    @users('user_sales_manager')
    def test_lead_merge_mixed(self):
        """ In case of mix, opportunities are on top, and result is an opportunity

        lead_1 -------------------opp----seq=1
        lead_w_partner_company ---opp----seq=1 (ID greater)
        lead_w_contact -----------lead---seq=30
        lead_w_email -------------lead---seq=3
        lead_w_partner -----------lead---seq=False
        """
        # ensure initial data
        (self.lead_w_partner_company | self.lead_1).write({'type': 'opportunity'})
        self.assertEqual(self.lead_w_partner_company.stage_id.sequence, 1)
        self.assertEqual(self.lead_1.stage_id.sequence, 1)

        merge = self.env['crm.merge.opportunity'].with_context({
            'active_model': 'crm.lead',
            'active_ids': self.leads.ids,
            'active_id': False,
        }).create({
            'team_id': self.sales_team_convert.id,
            'user_id': False,
        })
        # TDE FIXME: see aa44700dccdc2618e0b8bc94252789264104047c -> no user, no team -> strange
        merge.write({'team_id': self.sales_team_convert.id})

        # TDE FIXME: not sure the browse in default get of wizard intended to exlude lost, as it browse ids
        # and exclude inactive leads, but that's not written anywhere ... intended ??
        self.assertEqual(merge.opportunity_ids, self.leads - self.lead_w_email_lost)
        ordered_merge = self.lead_w_partner_company + self.lead_w_contact + self.lead_w_email + self.lead_w_partner

        result = merge.action_merge()
        merge_opportunity = self.env['crm.lead'].browse(result['res_id'])
        self.assertFalse((ordered_merge - merge_opportunity).exists())
        self.assertEqual(merge_opportunity, self.lead_1)
        self.assertEqual(merge_opportunity.type, 'opportunity')

        # merged opportunity has same salesman (not updated in wizard)
        self.assertEqual(merge_opportunity.user_id, self.user_sales_leads)
        # TDE FIXME: as same uer_id is enforced, team is updated through onchange and therefore stage
        self.assertEqual(merge_opportunity.team_id, self.sales_team_convert)
        # self.assertEqual(merge_opportunity.team_id, self.sales_team_1)
        # TDE FIXME: BUT team_id is computed after checking stage, based on wizard's team_id
        self.assertEqual(merge_opportunity.stage_id, self.stage_team_convert_1)

    @users('user_sales_manager')
    def test_merge_method(self):
        """ In case of mix, opportunities are on top, and result is an opportunity

        lead_1 -------------------opp----seq=1
        lead_w_partner_company ---opp----seq=1 (ID greater)
        lead_w_contact -----------lead---seq=30
        lead_w_email -------------lead---seq=3
        lead_w_partner -----------lead---seq=False
        """
        # # ensure initial data
        print("test merge method")
        for i in range(0, 50):
            for j in range(0, i + 1):
                print("* ", end="")
            print("\r")
        (self.lead_w_partner_company | self.lead_1).write({'type': 'opportunity'})
        leads = self.env['crm.lead'].browse(self.leads.ids)._sort_by_confidence_level(reverse=True)
        with self.assertLeadMerged(self.lead_1, leads,
                                   name='Nibbler Spacecraft Request',
                                   partner_id=self.contact_company_1,
                                   priority='2'):
            leads._merge_opportunity(auto_unlink=False, max_length=None)
