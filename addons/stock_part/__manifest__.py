# -*- coding: utf-8 -*-
{
    'name': "POS Live Quants",
    'summary': """
        Shows live quants on pos and adds the option to prevent selling """,
    'description': """
        Features:
        - Uses longpolling to update quant data in the POS client.
        - Shows quantities on ProductItems 
        - Gives the option to prevent adding quantities that are not available on hand
        - Additional validation layer on the backend. If it fails, orders are regenerated on the frontend
        
        Limitations:
        - The user needs to be online all the time for best performance
        - It is preferable to not sell products that are available on POS using the sales app
    """,
    'author': "odoo-psae",
    'website': "http://www.odoo.com",
    'category': 'POS',
    'version': '1.5',
    'depends': ['base', 'point_of_sale', 'stock', 'bus'],
    'data': [
        "security/ir.model.access.csv",
        "views/view_pos_config.xml",
        "views/assets.xml"
    ],
    'qweb': [
        'static/src/xml/Screens/ProductScreen/ProductItem.xml',
    ],
    'post_init_hook': "all_companies_real"
}
