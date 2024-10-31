from odoo import fields, models


class EventTagCategory(models.Model):
    _inherit = ['event.tag.category']

    show_on_resume = fields.Boolean("Show on Resume", help="Display events with this tag on employee resumes")


class EventTag(models.Model):
    _inherit = ['event.tag']

    show_on_resume = fields.Boolean(related='category_id.show_on_resume')
