from odoo import models


class ResUsers(models.Model):
    _inherit = "res.users"

    def _compute_im_status(self):
        super._compute_im_status()
        self.env.cr.execute(
            """
            SELECT
                user_id as id,
                status
            FROM user_presence
            WHERE user_id IN %s
        """,
            (tuple(self.ids),),
        )
        res = dict(
            ((status["id"], status["status"]) for status in self.env.cr.dictfetchall())
        )
        for user in self:
            user.im_status = res.get(user.id, "offline")
