# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json
import base64
import os

from odoo import models, fields, _
from odoo.exceptions import UserError, RedirectWarning
from . import business_card_scanner
from odoo.http import request


class CrmLead(models.Model):
    _inherit = "crm.lead"

    can_show_digitize_crm_lead_button = fields.Boolean('Can show the digitize crm button')

    def action_crm_lead_digitization(self):
        attachment = self.env['ir.attachment'].search([
            ('res_model', '=', 'crm.lead'),
            ('res_id', '=', self.id),
            ('index_content', '=', 'image')
        ], limit=1)
        data_url_prefix = f"data:{attachment.mimetype};base64,"
        ir_config = request.env["ir.config_parameter"].sudo()
        api_key = ir_config.get_param("crm.openai_api_key")
        if not api_key:
            msg = _("No OpenAI API key was provided. You can configure it from settings")
            action_id = self.env.ref('business_card_scanner.action_res_config_settings').id
            raise RedirectWarning(msg, action_id, _('Go to the configuration panel'))

        extracted_data = business_card_scanner.BusinessCardScanner.extract_data(self, attachment.datas, data_url_prefix, api_key)
        try:
            self.write({
                'name': extracted_data.get('business_name', ''),
                'type': 'lead',
                'contact_name': extracted_data.get('owners_name', ''),
                'phone': str(extracted_data.get('phone_numbers', [])).strip("[]").replace("'", ""),
                'email_from': extracted_data.get('email', ''),
                'website': extracted_data.get('website', ''),
                'street': extracted_data.get('address', ''),
            })
            with open("extracted_text_from_business_card.json", 'w') as outfile:
                outfile.write(json.dumps(extracted_data, indent=4))
                outfile_path = outfile.name
            with open(outfile_path, 'rb') as file:
                file_content = file.read()
            os.remove(outfile_path)
            encoded_content = base64.b64encode(file_content)
            self.env['ir.attachment'].create({
                'name': 'extracted_text_from_business_card.json',
                'type': 'binary',
                'datas': encoded_content,
                'res_model': 'crm.lead',
                'res_id': self.id
            })
        except AttributeError:
            raise UserError(
                _("The recently attached image file is not a valid business card. "
                "Please re-attach a valid business card image.")
            )

    def _create_crm_lead_from_attachment(self, attachment_ids):
        attachments = self.env['ir.attachment'].browse(attachment_ids)
        if not attachments:
            raise UserError(_("No attachment was provided"))

        for attachment in attachments:
            lead = self.env['crm.lead'].create({
                'name': attachment.name,
                'can_show_digitize_crm_lead_button': True,
            })
            self.env['ir.attachment'].create({
                'name': '',
                'type': 'binary',
                'datas': attachment.datas,
                'res_model': 'crm.lead',
                'res_id': lead.id
            })

        return lead

    def create_crm_lead_from_attachment(self, attachment_ids):
        leads = self._create_crm_lead_from_attachment(attachment_ids)
        action_vals = {
            'name': _('Generated Documents'),
            'domain': [('id', 'in', leads.ids)],
            'res_model': 'crm.lead',
            'type': 'ir.actions.act_window',
            'context': self._context
        }
        if len(leads) == 1:
            action_vals.update({
                'views': [[False, "form"]],
                'view_mode': 'form',
                'res_id': leads[0].id,
            })
        else:
            action_vals.update({
                'views': [[False, "list"], [False, "kanban"], [False, "form"]],
                'view_mode': 'list, kanban, form',
            })
        return action_vals
