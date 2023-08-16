# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class HtmlHistoryRevision(models.Model):
    _name = "field.html.history.revision"
    _description = "Field html History Revision"

    res_field = fields.Char('Related Document Model Field Name',
                            required=True, index=True)
    res_model = fields.Char('Related Document Model Name',
                            required=True, index=True)
    res_id = fields.Many2oneReference('Related Document ID',
                                      index=True, model_field='res_model')

    patch = fields.Text(string="Diff", readonly=True)
