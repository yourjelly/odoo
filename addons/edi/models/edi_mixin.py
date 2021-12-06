# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class EdiMixin(models.AbstractModel):
    _name = "edi.mixin"
    _description = "EDI Mixin"

    edi_document_ids = fields.One2many(
        comodel_name='edi.document',
        compute='_compute_edi_document_ids',
    )
    edi_message = fields.Html(
        compute='_compute_edi_message',
    )

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    def _create_edi_stage(self, code, content_method, web_service_method=None):
        return {
            'code': code,
            'content_method': content_method,
            'web_service_method': web_service_method,
        }

    def _get_edi_available_formats(self):
        self.ensure_one()
        return self.env['edi.format'].search([('res_model', '=', self._name)])

    # -------------------------------------------------------------------------
    # TO BE CALLED MANUALLY
    # -------------------------------------------------------------------------

    def _set_edi_message(self, edi_format, message, message_level='error'):
        self.ensure_one()
        document = self.edi_document_ids.filtered(lambda x: x.format_id == edi_format)
        document.ensure_one()
        document.write({
            'message': message,
            'message_level': message_level,
        })
        return document

    def _set_edi_stage(self, edi_format, stage_code, grouping_dict=None, use_web_services=False):
        self.ensure_one()

        if grouping_dict is None:
            grouping_dict = {'id': self.id}

        to_write = {
            'stage_code': stage_code,
            'use_web_services': use_web_services,
            'grouping_key': '-'.join(str(grouping_dict[k]) for k in sorted(grouping_dict.keys())),
            'message': None,
            'message_level': None,
        }

        document = self.edi_document_ids.filtered(lambda x: x.format_id == edi_format)
        if document:
            document.write(to_write)
        else:
            self.env['edi.document'].create({
                'format_id': edi_format.id,
                'res_model': self._name,
                'res_id': self.id,
                **to_write,
            })
        return document

    def _set_edi_attachment(self, edi_format, attachment, override_existing=False):
        self.ensure_one()
        document = self.edi_document_ids.filtered(lambda x: x.format_id == edi_format)
        document.ensure_one()

        is_dict = isinstance(attachment, dict)
        if document.attachment_id and override_existing and is_dict:
            document.attachment_id.write({k: v for k, v in attachment.items() if k in ('datas', 'raw')})
        elif is_dict:
            document.attachment_id = self.env['ir.attachment'].create(attachment)
        else:
            document.attachment_id = attachment
        return document

    def _get_edi_attachment(self, edi_format):
        self.ensure_one()
        document = self.edi_document_ids.filtered(lambda x: x.format_id == edi_format)
        document.ensure_one()
        return document.attachment_id

    def _set_edi_done(self, edi_format):
        self.ensure_one()
        document = self.edi_document_ids.filtered(lambda x: x.format_id == edi_format)
        document.ensure_one()

        document.write({
            'stage_code': None,
            'use_web_services': False,
            'grouping_key': None,
            'message': None,
            'message_level': None,
            'is_done': True,
        })
        return document

    # -------------------------------------------------------------------------
    # TO BE OVERRIDDEN
    # -------------------------------------------------------------------------

    def _get_edi_stages(self, edi_format):
        """ TO BE OVERRIDDEN. Determine the EDI flow the business object will follow.

        :param: edi_format: The edi.format applied.
        :return:            A list of stages created using the `_create_edi_stage` method.
        """
        return []

    def _get_edi_pdf_report_ids(self):
        """ TO BE OVERRIDDEN. Retrieve the ir.actions.report used to generate a PDF report that could be processed
        using the `_edi_prepare_to_export_pdf` method.

        :return: A list of ir.actions.report's ids.
        """
        self.ensure_one()
        return []

    def _is_edi_compatible(self, edi_format):
        return False

    def _edi_prepare_to_export_pdf(self, action_report, pdf_writer, edi_document):
        self.ensure_one()

    def _edi_prepare_to_send_by_mail(self, mail_values, edi_document):
        self.ensure_one()

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    def _compute_edi_document_ids(self):
        stored_ids = tuple(self._origin.ids)

        if stored_ids:
            self._cr.execute('''
                SELECT
                    edi_document.res_id,
                    ARRAY_AGG(edi_document.id) AS edi_document_ids
                FROM edi_document
                WHERE edi_document.res_model = %s AND edi_document.res_id IN %s
                GROUP BY edi_document.res_id
            ''', [self._name, stored_ids])
            res = dict(tuple(row) for row in self._cr.fetchall())
        else:
            res = {}

        for record in self:
            record.edi_document_ids = self.env['edi.document'].browse(res.get(record.id, []))

    @api.depends('edi_document_ids')
    def _compute_edi_message(self):
        for record in self:
            error_levels = set(record.mapped('blocked_level'))
            record.edi_message = error_levels

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

