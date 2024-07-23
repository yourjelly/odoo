import odoo
from odoo import models


class Partner(models.Model):
    _inherit = "res.partner"

    def _compute_im_status(self):
        super()._compute_im_status()
        self.env.cr.execute(
            """
            SELECT
                U.partner_id as id,
                CASE
                    WHEN COUNT(P.status) FILTER (WHERE P.status = 'online') > 0 THEN 'online'
                    ELSE 'away'
                END AS status
            FROM
                user_presence P
            INNER JOIN
                res_users U
                ON P.user_id = U.id
            WHERE
                U.partner_id IN %s
                AND U.active = TRUE
            GROUP BY
                U.partner_id;
        """,
            (tuple(self.ids),),
        )
        res = dict(
            ((status["id"], status["status"]) for status in self.env.cr.dictfetchall())
        )
        for partner in self:
            if partner.im_status == "bot":
                continue
            if partner.id not in res:
                partner.im_status = (
                    "offline"
                    if any(u.active for u in partner.user_ids)
                    else "im_partner"
                )
            else:
                partner.im_status = res[partner.id]
