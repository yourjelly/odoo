# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _
from odoo.http import route, request
from odoo.addons.mail.models.discuss.mail_guest import add_guest_to_context
from odoo.addons.mail.controllers.attachment import AttachmentController


class CloudAttachmentController(AttachmentController):
    @route()
    @add_guest_to_context
    def mail_attachment_upload(self, ufile, thread_id, thread_model, is_pending=False, **kwargs):
        if ((is_cloud_storage := kwargs.get('cloud_storage'))
                and not request.env['ir.config_parameter'].sudo().get_param('cloud_storage_provider')):
            return request.make_json_response({
                'error': _('Cloud storage configuration has been changed. Please refresh the page.')
            })

        response = super().mail_attachment_upload(ufile, thread_id, thread_model, is_pending, **kwargs)

        if not is_cloud_storage:
            return response

        attachmentData = response.json
        if attachmentData.get('error'):
            return response

        # append upload url to the response to allow the client to directly
        # upload files to the cloud storage
        attachment = request.env['ir.attachment'].browse(attachmentData['id']).sudo()
        attachmentData['upload_info'] = request.env['cloud.storage.provider']._generate_upload_info(attachment)
        return request.make_json_response(attachmentData)
