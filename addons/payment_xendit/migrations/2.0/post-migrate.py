# -*- coding: utf-8 -*-
from odoo import api, SUPERUSER_ID

def migrate(cr, version):
    env = api.Environment(cr, SUPERUSER_ID, {})

    # update the inline_form_view_id to databases with existing xendit
    inline_form_view_id = env.ref('payment_xendit.inline_form').id
    if inline_form_view_id:
        cr.execute(
            """
                UPDATE payment_provider
                SET inline_form_view_id=%s,
                    allow_tokenization=true
                WHERE code='xendit';
            """, [inline_form_view_id,]
        )
