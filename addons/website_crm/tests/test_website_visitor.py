# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.crm.tests.common import TestCrmCommon
from odoo.tests.common import users


class TestWebsiteVisitor(TestCrmCommon):

    def setUp(self):
        super(TestWebsiteVisitor, self).setUp()
        self.test_partner = self.env['res.partner'].create({
            'name': 'Test Customer',
            'email': '"Test Customer" <test@test.example.com>',
            'country_id': self.env.ref('base.be').id,
            'mobile': '+32456001122'
        })

    @users('user_sales_manager')
    def test_compute_email_phone(self):
        visitor_sudo = self.env['website.visitor'].sudo().create({
            'name': 'Mega Visitor',
        })
        visitor = visitor_sudo.with_user(self.env.user)  # as of 13.0 salesmen cannot create visitors, only read them
        customer = self.test_partner.with_user(self.env.user)
        self.assertFalse(visitor.email)
        self.assertFalse(visitor.mobile)

        # partner information copied on visitor -> behaves like related
        visitor_sudo.write({'partner_id': self.test_partner.id})
        self.assertEqual(visitor.email, customer.email_normalized)
        self.assertEqual(visitor.mobile, customer.mobile)

        # if reset -> behaves like a related, also reset on visitor
        visitor_sudo.write({'partner_id': False})
        self.assertFalse(visitor.email)
        self.assertFalse(visitor.mobile)

        # first lead created -> updates email
        lead_1 = self.env['crm.lead'].create({
            'name': 'Test Lead 1',
            'email_from': 'Rambeau Fort <beaufort@test.example.com',
            'visitor_ids': [(4, visitor.id)],
        })
        self.assertEqual(visitor.email, lead_1.email_normalized)
        self.assertFalse(visitor.mobile)

        # second lead created -> keep first email but takes mobile as not defined before
        lead_2 = self.env['crm.lead'].create({
            'name': 'Test Lead 1',
            'email_from': 'Martino Brie <brie@test.example.com',
            'country_id': self.env.ref('base.be').id,
            'mobile': '+32456001122',
            'visitor_ids': [(4, visitor.id)],
        })
        self.assertEqual(visitor.email, lead_1.email_normalized)
        self.assertEqual(visitor.mobile, lead_2.mobile)

        # partner win on leads
        visitor_sudo.write({'partner_id': self.test_partner.id})
        self.assertEqual(visitor.email, customer.email_normalized)
        self.assertEqual(visitor.mobile, customer.mobile)

        # partner updated -> fallback on leads
        customer.write({'mobile': False})
        self.assertEqual(visitor.email, customer.email_normalized)
        self.assertEqual(visitor.mobile, lead_2.mobile)

        #merge two leads (logic)
        #two cases to consider -> merging two leads and merging one lead and one oppurtunity

    @users('user_sales_manager')
    def test_merge_vistors_crm(self):
        """ In case of mix, opportunities are on top, and result is an opportunity
        """

        visitor_sudo_1 = self.env['website.visitor'].sudo().create({
            'name': 'Visitor 1',
        })
        visitor = visitor_sudo_1.with_user(self.env.user)
        print("visitor_sudo////////////////",visitor_sudo_1)
        print("visitor...........",visitor)
        # visitor_sudo_1.write({'partner_id': self.test_partner.id})



        lead1 = self.env['crm.lead'].create({
            'name': 'Lead 1',
            'type': 'lead',
            'visitor_ids': [(4, visitor.id)],
            'email_from': 'Roy Fort <fortroy@test.example.com',


        })
        print("lead1",lead1)
        print("lead1 vistor id",lead1.visitor_ids)
        lead2 =  self.env['crm.lead'].create({
            'name': 'Lead 2',
            'type': 'lead',
            'email_from': 'Amy Wong <woonngamy@test.example.com',

        })
        # print("leads 2 ,,,,,,,,,,,,", lead2)
        leads = self.env['crm.lead']
        # print("leads...",leads,leads.ids)
        #
        # merge = self.env['crm.lead'].with_context({
        #     'active_model': 'crm.lead',
        #     'active_ids': leads.ids,
        #     'active_id': False,
        # }).create({'visitor_ids': [(4, visitor.id)]})
        # print("kkkkkkkkkkkkkkkkkkkkkkkkk",merge)

        #
        with self.assertLeadMerged(lead1, leads,
                                   name='Lead 1',
                                  ):
            leads._merge_opportunity(auto_unlink=False, max_length=None)

