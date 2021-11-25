# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase
from odoo.tests.common import Form


class TestMassMailingContacts(TransactionCase):

    def test_mass_mailing_crm(self):
        partner = self.env['res.partner']
        partner_1 = partner.create({
            'name': 'Partner 1',
            'email': 'partner1@test.com',
        })
        partner_2 = partner.create({
            'name': 'Partner 2',
            'email': 'partner2@test.com',
        })
        partner_3 = partner.create({
            'name': 'Partner 3',
            'email': 'partner3@test.com',
        })

        all_contacts = partner_1 | partner_2 | partner_3
        action = self.env["ir.actions.actions"]._for_xml_id("mail.action_partner_mass_mail")
        action['context'] = {'active_model': 'res.partner', 'active_ids': all_contacts.ids}
        # Checks whether res_model of action is mailing.mailing or not
        self.assertEqual(action.get('res_model'), 'mailing.mailing')
        form = Form(self.env[action['res_model']].with_context(action['context']))
        form.subject = "Test Subject"
        form.save()
        # Checks whether mailing_domain and mailing_model_id is according to the selected records or not
        self.assertEqual(form.mailing_domain, str([('id', 'in', all_contacts.ids)]))
        self.assertEqual(form.mailing_model_id, self.env['ir.model']._get('res.partner'))
