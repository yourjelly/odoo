# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api
from psycopg2 import OperationalError
import logging

_logger = logging.getLogger(__name__)

DEFAULT_BLOCKING_LEVEL = 'error'


class EdiDocument(models.Model):
    _name = "edi.document"
    _description = "EDI Document"

    format_id = fields.Many2one(
        comodel_name='edi.format',
        required=True,
    )
    res_model = fields.Char(
        string="Related Document Model",
        index=True,
        required=True,
    )
    res_id = fields.Many2oneReference(
        string="Related Document ID",
        model_field='res_model',
        index=True,
        required=True,
    )
    attachment_id = fields.Many2one(
        string="Generated EDI file",
        comodel_name='ir.attachment',
    )
    stage_code = fields.Char(
        string="Next Stage",
        index=True,
    )
    use_web_services = fields.Boolean()
    is_done = fields.Boolean()
    grouping_key = fields.Char(
        string="Grouping key",
        index=True,
    )
    message = fields.Html()
    message_level = fields.Selection(
        selection=[('info', "Info"), ('warning', "Warning"), ('error', "Error")],
        help="Blocks the document current operation depending on the error severity :\n"
        "  * Info: the document is not blocked and everything is working as it should.\n"
        "  * Warning : there is an error that doesn't prevent the current Electronic Invoicing operation to succeed.\n"
        "  * Error : there is an error that blocks the current Electronic Invoicing operation.",
    )

    _sql_constraints = [
        (
            'unique_edi_document_by_document_by_format',
            'UNIQUE(format_id, res_model, res_id)',
            "Only one edi document by move by format",
        ),
    ]

    @api.model
    def _prepare_jobs(self, domain=None):
        """ Creates a list of jobs to be performed by '_process_job' for the documents in self.
        Each document is a batch of represent of documents that could be process together.

        :param domain: Optional domain to filter the edi.documents.
        :return: A list of dictionaries:
            * res_model:        The business object model.
            * format_id:        The id of the originator edi.format.
            * grouping_key:     The common grouping_key of all these documents.
            * stage_code:  The next stage for documents.
            * document_ids:     The ids of some edi.document.
        """
        self.env['edi.document'].flush(self.env['edi.document']._fields)

        query_obj = self._where_calc([('stage_code', '!=', False), ('message_level', '!=', 'error')] + (domain or []))
        tables, where_clause, where_clause_params = query_obj.get_sql()

        self._cr.execute(f'''
            SELECT
                edi_document.res_model,
                edi_document.format_id,
                edi_document.grouping_key,
                edi_document.stage_code,
                ARRAY_AGG(edi_document.id) AS document_ids
            FROM {tables}
            WHERE {where_clause}
            GROUP BY
                edi_document.res_model,
                edi_document.format_id,
                edi_document.grouping_key,
                edi_document.stage_code
        ''', where_clause_params)
        return self._cr.dictfetchall()

    @api.model
    def _process_job(self, job):
        """ Process a single job..

        :param job: See the `_prepare_jobs` method.
        """
        edi_format = self.env['edi.format'].browse(job['format_id'])
        edi_documents = self.env['edi.document'].browse(job['edi_document_ids'])
        records = self.env[job['res_model']].browse(edi_documents.mapped('res_id'))
        orphan_attachments = edi_documents.attachment_id.filtered(lambda x: not x.res_model or not x.res_id)

        stage_code = job['stage_code']
        stages = records._get_edi_stages()
        next_stage = [x for x in stages if x['code'] == stage_code][0]

        # Document generation
        document_res = records[next_stage['content_method']]()

        message = message_level = None

        if document_res.get('message'):
            message = document_res['message']
            message_level = document_res.get('message_level', 'error')

        attachment_id = document_res.get('attachment_id')

        if next_stage.get('web_service_method'):
            # ==== With web-service ====

            if message_level not in ('error', 'warning'):
                # Call the web-service.
                webservice_res = records[next_stage['web_service_method']](document_res['document_str'])

                if webservice_res.get('message'):
                    message = webservice_res['message']
                    message_level = webservice_res.get('message_level', 'error')

        edi_documents.write({
            'message': message,
            'message_level': message_level,
            'attachment_id': attachment_id,
        })

        if message_level not in ('error', 'warning'):

            for edi_document in edi_documents:
                record = self.env[job['res_model']].browse(edi_document.res_id)
                stage_code, grouping_dict = record._get_edi_stage_infos(edi_format)

                grouping_key = '-'.join(str(grouping_dict[k]) for k in sorted(grouping_dict.keys()))
                edi_document.write({
                    'stage_code': stage_code,
                    'grouping_key': grouping_key,
                })

        if orphan_attachments:
            orphan_attachments.unlink()

    def _process_documents_no_web_services(self):
        """ Post and cancel all the documents that don't need a web service.
        """
        jobs = self._prepare_jobs(domain=[('format_id.need_web_services', '=', True)])
        for job in jobs:
            self._process_job(job)

    @api.model
    def _cron_process_documents_web_services(self, job_count=None, with_commit=True):
        ''' Post and cancel all the documents that need a web service.

        :param job_count:   The maximum number of jobs to process if specified.
        :param with_commit: Flag indicating a commit should be made between each job.
        :return:            The number of remaining jobs to process.
        '''
        jobs = self._prepare_jobs(domain=[('format_id.need_web_services', '=', True)])
        if job_count:
            retrigger_needed = len(jobs) > job_count
            jobs = jobs[:job_count]
        else:
            retrigger_needed = False

        is_singleton = len(jobs) == 1
        for job in jobs:
            edi_format = self.env['edi.format'].browse(job['format_id'])
            edi_documents = self.env['edi.document'].browse(job['edi_document_ids'])
            records = self.env[job['res_model']].browse(edi_documents.mapped('res_id'))
            orphan_attachments = edi_documents.attachment_id.filtered(lambda x: not x.res_model or not x.res_id)

            try:
                with self.env.cr.savepoint(flush=False):
                    self._cr.execute(
                        'SELECT * FROM edi_document WHERE id IN %s FOR UPDATE NOWAIT',
                        [tuple(edi_documents.ids)],
                    )
                    self._cr.execute(
                        'SELECT * FROM %s WHERE id IN %s FOR UPDATE NOWAIT',
                        [records._name, tuple(records.ids)],
                    )
                    if orphan_attachments:
                        self._cr.execute(
                            'SELECT * FROM ir_attachment WHERE id IN %s FOR UPDATE NOWAIT',
                            [tuple(orphan_attachments.ids)],
                        )

                    self._process_job(job)
            except OperationalError as e:
                if e.pgcode == '55P03':
                    _logger.debug('Another transaction already locked documents rows. Cannot process documents.')
                else:
                    raise e
            else:
                if with_commit and not is_singleton:
                    self._cr.commit()

        # Mark the CRON to be triggered again asap since there is some remaining jobs to process.
        if retrigger_needed:
            self.env.ref('edi.ir_cron_edi_network')._trigger()
