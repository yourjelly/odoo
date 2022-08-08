# -*- coding: utf-8 -*-

from . import controllers
from . import models
from odoo import api, SUPERUSER_ID


def all_companies_real(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    env["res.company"].search([]).write(dict(point_of_sale_update_stock_quantities='real'))
