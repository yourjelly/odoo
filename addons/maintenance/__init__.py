# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models


def pre_init_hook(env):
    env["res.config.settings"].create({'group_project_recurring_tasks': True}).execute()
