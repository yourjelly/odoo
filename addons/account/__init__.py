# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

def _set_fiscal_country(env):
    """ Sets the fiscal country on existing companies when installing the module.
    That field is an editable computed field. It doesn't automatically get computed
    on existing records by the ORM when installing the module, so doing that by hand
    ensures existing records will get a value for it if needed.
    """
    env['res.company'].search([]).compute_account_tax_fiscal_country()

def _initiate_onboardings(env):
    """ Since account does not make use of the standard onboarding banner which is
    responsible for the initiation of the onboarding, this is done on module installation
    and on company creation.
    """
    for company in env['res.company'].search([]):
        env.ref('account.onboarding_onboarding_account_dashboard').with_company(company)._search_or_create_progress()

def _account_post_init(env):
    _set_fiscal_country(env)
    _initiate_onboardings(env)

# imported here to avoid dependency cycle issues
# pylint: disable=wrong-import-position
from . import controllers
from . import models
from . import demo
from . import wizard
from . import report
from . import populate
from . import tools
