# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class SkillType(models.Model):
    _name = 'hr.skill.type'
    _description = "Skill Type"
    _order = "name"

    active = fields.Boolean('Active', default=True)
    name = fields.Char(required=True)
    skill_ids = fields.One2many('hr.skill', 'skill_type_id', string="Skills")
    skill_level_ids = fields.One2many('hr.skill.level', 'skill_type_id', string="Levels")

    def _set_default_level(self):
        if self.env.context.get('no_skill_level_check'):
            return

        for types in self:
            if not types.skill_level_ids.filtered('default_level'):
                types.skill_level_ids[:1].default_level = True

    def toggle_active(self):
        res = super().toggle_active()
        active_skill_type = self.filtered('active')
        active_skill_type.with_context(active_test=False).skill_ids.action_unarchive()
        active_skill_type.with_context(active_test=False).skill_level_ids.action_unarchive()
        (self - active_skill_type).skill_ids.action_archive()
        (self - active_skill_type).skill_level_ids.action_archive()
        return res
