{
    'name': "Funnel Chart Generator",
    'sequence': 2,

    'summary': """
        Generate Funnel Chart as per Data""",

    'description': """
        Funnel Chart Generator Module generate funnel chart as per records.
        This Funnel Chart depends on Product Vs. Location. If we search by
        using product name then funnel chart will be generate base on location
        and lot and when we search by using location name then funnel chart
        will be generate on product name and lot value.""",

    'author': "My Company",
    'website': "http://www.yourcompany.com",

    'category': 'Uncategorized',
    'version': '0.1',

    'depends': ['stock', 'base_address_city'],

    'data': [
        'views/product_template_views.xml',
        'views/product_funnel_templates.xml',
    ],

    'qweb': [
        'static/src/xml/funnel_chart.xml',
    ],

    'application': True,
}
