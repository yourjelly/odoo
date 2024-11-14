# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Payment Provider: DPO",
    'category': 'Accounting/Payment Providers',
    'sequence': 350,
    'summary': "A Kenyan payment provider covering several African countries.",
    'description': " ",  # Non-empty string to avoid loading the README file.
    'depends': ['payment'],
    'data': [
        'views/payment_provider_views.xml',
        'views/payment_dpo_templates.xml',

        'data/payment_provider_data.xml',
    ],
    'post_init_hook': 'post_init_hook',
    'uninstall_hook': 'uninstall_hook',
    'license': 'LGPL-3',
}

# TODO-DPO: add tests
# TODO-DPO: add readme
# TODO-DPO: add .pot
