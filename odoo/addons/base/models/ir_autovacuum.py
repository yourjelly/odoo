# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import api, models
from odoo.exceptions import AccessDenied
from odoo.tools import topological_sort

_logger = logging.getLogger(__name__)


class AutoVacuum(models.AbstractModel):
    """ Expose the vacuum method to the cron jobs mechanism. """
    _name = 'ir.autovacuum'
    _description = 'Automatic Vacuum'

    @api.model
    def _gc_transient_models(self):
        # Sort transient models following foreign keys, so that if A has a
        # foreign key to B, then A is processed before B (except for cycles).
        # This reduces the cascading effects of the deletion.
        has_fk_relation = {
            model_name: [
                field.comodel_name
                for field_name, field in Model._fields.items()
                if field.type == 'many2one'
            ]
            for model_name, Model in self.pool.items()
            if Model.is_transient()
        }
        for mname in reversed(topological_sort(has_fk_relation)):
            model = self.env[mname]
            if model.is_transient():
                try:
                    with self._cr.savepoint():
                        model._transient_vacuum(force=True)
                except Exception as e:
                    _logger.warning("Failed to clean transient model %s\n%s", model, str(e))

    @api.model
    def _gc_user_logs(self):
        self._cr.execute("""
            DELETE FROM res_users_log log1 WHERE EXISTS (
                SELECT 1 FROM res_users_log log2
                WHERE log1.create_uid = log2.create_uid
                AND log1.create_date < log2.create_date
            )
        """)
        _logger.info("GC'd %d user log entries", self._cr.rowcount)

    @api.model
    def power_on(self, *args, **kwargs):
        if not self.env.user._is_admin():
            raise AccessDenied()
        self.env['ir.attachment']._file_gc()
        self._gc_transient_models()
        self._gc_user_logs()
        return True
