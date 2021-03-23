# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import controllers
from . import models

from odoo import api, SUPERUSER_ID
from odoo.tools import html_sanitize

def _set_default_stock_messages(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})

    env.cr.execute(
        """
            UPDATE website
            SET available_message=%s
        """,
        [env.ref('website_sale_stock.available_message')._render().decode('utf-8')]
    )

    env.cr.execute(
        """
            UPDATE website
            SET out_of_stock_message=%s
        """,
        [env.ref('website_sale_stock.out_of_stock_message')._render().decode('utf-8')]
    )

    env.cr.execute(
        """
            UPDATE website
            SET threshold_message=%s
        """,
        [env.ref('website_sale_stock.threshold_message')._render().decode('utf-8')]
    )
