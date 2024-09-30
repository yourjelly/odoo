from odoo import api


def migrate(cr, version):
    env = api.Environment(cr, api.SUPERUSER_ID, {})
    for company in env['res.company'].search([('chart_template', '=', 'se')], order="parent_path"):
        env['account.chart.template'].try_loading('se', company)
