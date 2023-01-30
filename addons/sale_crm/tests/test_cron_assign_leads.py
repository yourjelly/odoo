# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.crm.tests.test_crm_lead_assignment import TestLeadAssignCommon
from odoo.tests.common import tagged


@tagged('lead_assign')
class TestSalesLeadAssign(TestLeadAssignCommon):
    def test_cron_assign_leads(self):
        def _create_crm_lead(name, email, company_id=False, lead_type="lead"):
            return self.env['crm.lead'].create({
                'name': name,
                'email_from': email,
                'type': lead_type,
                'company_id': company_id,
                'team_id': False,
                'user_id': False,
            })
        company_1 = self.env.ref('base.main_company')
        self._activate_multi_company()
        self.team_company2.company_id = False
        email = ['test1@test.example.com', 'test2@test.example.com', 'test3@test.example.com', 'test4@test.example.com']

        opportunity1 = _create_crm_lead("Opportunity 1 without sale order and company1", email[0], company_1.id, lead_type="opportunity")
        dup_opportunity1 = _create_crm_lead("Duplicate of opportunity 1 with sale order and company2", email[0], self.company_2.id)

        opportunity2 = _create_crm_lead("Opportunity 2 without sale order and company 1", email[1], company_1.id, lead_type="opportunity")
        dup1_opportunity2 = _create_crm_lead("Duplicate of 1 opportunity 2 with sale order and company 2", email[1], self.company_2.id)
        dup2_opportunity2 = _create_crm_lead("Duplicate 2 of opportunity 2 without sale order and company 1", email[1], company_1.id)

        opportunity3 = _create_crm_lead("Opportunity 3 with sale order and company 2", email[2], self.company_2.id, lead_type="opportunity")
        dup1_opportunity3 = _create_crm_lead("Duplicate 1 of opportunity 3 without sale order and company", email[2])
        dup2_opportunity3 = _create_crm_lead("Duplicate 2 of opportunity 3 with sale order and company 1", email[2], company_1.id)

        opportunity4 = _create_crm_lead("Opportunity 4 without sale order and company 2", email[3], self.company_2.id, lead_type="opportunity")
        dup1_opportunity4 = _create_crm_lead("Duplicate 1 of opportunity 4 without sale order and company 2", email[3], self.company_2.id)
        dup2_opportunity4 = _create_crm_lead("Duplicate 2 of opportunity 4 with sale order and company 1", email[3], company_1.id)
        dup3_opportunity4 = _create_crm_lead("Duplicate 3 of opportunity 4 with sale order and company 2", email[3], self.company_2.id)

        so_vals = []
        so_of_opportunities = [
            dup_opportunity1,
            dup1_opportunity2,
            opportunity3,
            dup2_opportunity3,
            opportunity4,
            dup2_opportunity4,
            dup3_opportunity4
        ]
        for opportunity in so_of_opportunities:
            so_vals.append({
                'partner_id': self.contact_1.id,
                'company_id': opportunity.company_id.id or company_1.id,
                'opportunity_id': opportunity.id
                })
        self.env['sale.order'].create(so_vals)
        self.env['crm.team']._cron_assign_leads()

        self.assertTrue(opportunity1.exists())
        self.assertFalse(opportunity1.team_id)
        self.assertFalse(opportunity1.user_id)
        self.assertTrue(dup_opportunity1.exists())
        self.assertFalse(dup_opportunity1.team_id)
        self.assertFalse(dup_opportunity1.user_id)

        self.assertTrue(opportunity2.exists())
        self.assertTrue(opportunity2.team_id)
        self.assertTrue(opportunity2.user_id)
        self.assertTrue(dup1_opportunity2.exists())
        self.assertFalse(dup1_opportunity2.team_id)
        self.assertFalse(dup1_opportunity2.user_id)
        self.assertFalse(dup2_opportunity2.exists())

        self.assertTrue(opportunity3.exists())
        self.assertTrue(opportunity3.team_id)
        self.assertTrue(opportunity3.user_id)
        self.assertFalse(dup1_opportunity3.exists())
        self.assertTrue(dup2_opportunity3.exists())
        self.assertFalse(dup2_opportunity3.team_id)
        self.assertFalse(dup2_opportunity3.user_id)

        self.assertTrue(opportunity4.exists())
        self.assertTrue(opportunity4.team_id)
        self.assertTrue(opportunity4.user_id)
        self.assertFalse(dup1_opportunity4.exists())
        self.assertTrue(dup2_opportunity4.exists())
        self.assertFalse(dup2_opportunity4.team_id)
        self.assertFalse(dup2_opportunity4.user_id)
        self.assertFalse(dup3_opportunity4.exists())
