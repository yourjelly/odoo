import werkzeug

from odoo import http
from odoo.http import request

class PosCustomerDisplay(http.Controller):
    @http.route("/pos-customer-display/<access_token>", auth="public", type="http", website=True)
    def pos_customer_display(self, access_token):
        pos_config_sudo = request.env["pos.config"].sudo().search([("access_token", "=", access_token)])
        if not pos_config_sudo or pos_config_sudo.customer_display_type == "none":
            raise werkzeug.exceptions.Unauthorized()
        return request.render(
            "pos_customer_display.index",
            {
                "session_info": {
                    **request.env["ir.http"].get_frontend_session_info(),
                    **pos_config_sudo._get_customer_display_data(),
                },
            },
        )
