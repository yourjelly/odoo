# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models


class SocialShareModelFieldAllowList(models.Model):
    _name = 'social.share.model.field.allow.list'

    field_id = fields.Many2one('ir.model.fields')
