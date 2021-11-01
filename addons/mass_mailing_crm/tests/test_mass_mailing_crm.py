# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase
from odoo.tests.common import Form


class TestMassMailingCrm(TransactionCase):

    def test_mass_mailing_crm(self):
        lead = self.env['crm.lead']
        lead_1 = lead.create({
            'name': 'lead 1',
            'email_from': 'lead1@test.com',
        })
        lead_2 = lead.create({
            'name': 'lead 2',
            'email_from': 'lead2@test.com',
        })
        lead_3 = lead.create({
            'name': 'lead 3',
            'email_from': 'lead3@test.com',
        })

        all_leads = lead_1 | lead_2 | lead_3
        action = self.env["ir.actions.actions"]._for_xml_id("crm.action_lead_mass_mail")
        action['context'] = {'active_model': 'crm.lead', 'active_ids': all_leads.ids}
        # Checks whether res_model of action is mailing.mailing or not
        self.assertEqual(action.get('res_model'), 'mailing.mailing')
        form = Form(self.env[action['res_model']].with_context(action['context']))
        form.subject = "Test Subject"
        form.save()
        # Checks whether mailing_domain and mailing_model_id is according to the selected records or not
        self.assertEqual(form.mailing_domain, str([('id', 'in', all_leads.ids)]))
        self.assertEqual(form.mailing_model_id, self.env['ir.model']._get('crm.lead'))
