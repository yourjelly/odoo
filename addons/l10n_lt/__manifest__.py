# Author: Silvija Butko. Copyright: JSC Focusate.
{
    'name': "Lithuania - Accounting",
    'version': '1.0.0',
    'summary': 'accounting, Lithuanian',
    'license': 'LGPL-3',
    'author': "Focusate",
    'website': "http://www.focusate.eu",
    'category': 'Localization',
    'depends': [
        'l10n_multilang',
    ],
    'data': [
        'data/account_account_tag_data.xml',
        'data/account_chart_template_data.xml',
        'data/account.account.template.csv',
        'data/account_chart_template_setup_data.xml',
        'data/res_bank_data.xml',
        'data/account_tax_group_data.xml',
        'data/account_tax_template_data.xml',
        'data/account_fiscal_position_template_data.xml',
        # Try Loading COA for Current Company
        'data/account_chart_template_load.xml',
        'data/menuitem_data.xml',
    ],
    'post_init_hook': 'load_translations',
    'installable': True,
}
