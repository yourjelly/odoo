# -*- coding: utf-8 -*-
{
    "name": "Mail Template Security",
    "summary": "Restrict the use of email templates containing dynamic placeholders (jinja) to a specific group.",
    "version": "1.0",
    "depends": ["mail", "sms"],
    "category": "Hidden",
    "data": [
        "data/mail_template_security_data.xml",
        "wizard/mail_compose_message_views.xml",
    ],
    "auto_install": False,
}
