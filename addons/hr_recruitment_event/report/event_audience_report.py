# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, tools

class EventAudienceReport(models.BaseModel):
    _auto = False
    _name = 'events.audience.report'
    _description = 'Events Audience Report'

    id = fields.Id()

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)

