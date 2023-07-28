# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import controllers
from . import models
from odoo.tools import sql

def _pre_init_sale_quotation_builder(env):
    """ Allow installing sale_quotation_builder in databases
    with large sale.order / sale.order.line tables.

    Since website_description fields computation is based
    on new fields added by the module, they will be empty anyway.

    By avoiding the computation of those fields,
    we reduce the installation time noticeably
    """
    sql.create_column(env.cr, "sale_order", "website_description", 'text')
    sql.create_column(env.cr, "sale_order_line", "website_description", 'text')
    sql.create_column(env.cr, "sale_order_template_line", "website_description", 'text')
    sql.create_column(env.cr, "sale_order_template_option", "website_description", 'text')
