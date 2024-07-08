from odoo import models


class ResUsers(models.Model):
    _inherit = 'res.users'

    def _tracked_groups(self):
        return super()._tracked_groups() | {
            'account.group_account_user',
            'account.group_account_readonly',
            'account.group_account_manager',
            'account.group_account_invoice',
            'account.group_validate_bank_account',
            'base.group_system',
            'base.group_erp_manager',
        }
