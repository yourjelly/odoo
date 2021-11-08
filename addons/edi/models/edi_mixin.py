# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class EdiMixin(models.AbstractModel):
    _name = "edi.mixin"
    _description = "EDI Mixin"

    edi_document_ids = fields.One2many(
        comodel_name='account.edi.document',
        compute='_compute_edi_document_ids',
    )
    edi_message = fields.Html(
        compute='_compute_edi_message'
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

    def _create_missing_edi_documents(self):
        edi_document_to_create = []
        for record in self:
            current_formats = self.edi_document_ids.format_id
            for edi_format in self._get_edi_available_formats():
                if edi_format in current_formats:
                    continue

                next_stage_code, grouping_dict = self._get_edi_stage_infos(edi_format)
                if not grouping_dict:
                    continue

                edi_document_to_create.append({
                    'format_id': edi_format.id,
                    'res_model': record._name,
                    'res_id': record.id,
                    'next_stage_code': next_stage_code,
                    'grouping_key': '-'.join(str(grouping_dict[k]) for k in sorted(grouping_dict.keys())),
                })

        if edi_document_to_create:
            self.env['edi.document'].create(edi_document_to_create)

    # -------------------------------------------------------------------------
    # TO BE OVERRIDDEN
    # -------------------------------------------------------------------------

    @api.model
    def _get_edi_stages(self):
        """ TO BE OVERRIDDEN. Determine the EDI flow the business object will follow.

        :return: A list of stages created using the `_create_edi_stage` method.
        """
        return []

    def _get_edi_pdf_report(self):
        """ TO BE OVERRIDDEN. Retrieve the ir.actions.report used to generate a PDF report that could be processed
        using the `_edi_prepare_to_export_pdf` method.

        :return: A list of ir.actions.report.
        """
        self.ensure_one()
        return []

    def _get_edi_stage_infos(self, edi_format):
        self.ensure_one()
        return None, {}

    def _edi_prepare_to_export_pdf(self, action_report, pdf_writer, edi_document):
        self.ensure_one()

    def _edi_prepare_to_send_by_mail(self, mail_values, edi_document):
        self.ensure_one()

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    def _compute_edi_document_ids(self):
        stored_ids = self._origin.ids

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

