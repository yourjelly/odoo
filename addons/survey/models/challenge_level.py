from odoo import models, fields


class ChallengeLevel(models.Model):
    _name = 'challenge.level'
    _description = 'Odoo Challenge Level Model'
    _order = 'level, id'

    name = fields.Char('Technical Name', required=True)
    level = fields.Integer('Level', required=True)
    description = fields.Text('Help')
    hint = fields.Text('Hint', required=True)
    sequence = fields.Integer()