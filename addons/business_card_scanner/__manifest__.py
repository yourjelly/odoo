{
    'name': 'Business Card Scanner',
    'version': '1.0.0',
    'category': 'Sales/CRM',
    'summary': 'Scan Business cards and fetch important details',
    'description': """
        The Business Card Scanner module is a powerful tool designed to streamline the 
        digitization of business cards within Odoo. It enables users to scan business 
        cards using their device's camera or by uploading an image file, and then 
        automatically extracts essential information such as the business name, 
        owner's name, phone numbers, email addresses, websites, and physical addresses 
        using OpenAI API. This extracted data can be quickly converted into new contacts 
        or CRM leads, enhancing productivity and ensuring that important business 
        connections are efficiently recorded and managed. The module features an 
        intuitive interface, customizable user permissions, and robust error handling 
        and notifications. By eliminating manual data entry and reducing errors, the 
        Business Card Scanner module significantly boosts efficiency and accuracy in 
        managing business card information.
    """,
    'license': 'LGPL-3',
    'author': 'Saurabh Choraria',
    'depends': [
        'base', 'web_editor', 'crm', 'contacts'
    ],

    'data': [
        'views/res_partner_views.xml',
        'views/crm_lead_views.xml',
        'views/res_config_settings.xml',
    ],

    'installable': True,
    'auto_install': False,

    'assets': {
        'web.assets_backend': [
            'business_card_scanner/static/src/*',
        ],
    },
}
