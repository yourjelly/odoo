# -*- coding: utf-8 -*-

{
    'name': 'Lunch',
    'sequence': 120,
    'version': '1.0',
    'depends': ['base', 'web', 'decimal_precision'],
    'category': 'Human Resources',
    'summary': 'Lunch Order, Meal, Food',
    'description': """
The base module to manage lunch.
================================

Many companies order sandwiches, pizzas and other, from usual vendors, for their employees to offer them more facilities.

However lunches management within the company requires proper administration especially when the number of employees or vendors is important.

The “Lunch Order” module has been developed to make this management easier but also to offer employees more tools and usability.

In addition to a full meal and vendor management, this module offers the possibility to display warning and provides quick order selection based on employee’s preferences.

If you want to save your employees' time and avoid them to always have coins in their pockets, this module is essential.
    """,
    'data': [
        'views/top_menus.xml',
        'views/category_views.xml',
        'views/company_views.xml',
        'views/location_views.xml',
        'views/product_views.xml',
        'views/supplier_views.xml',
        'views/user_views.xml',
    ],
    'demo': [
        'data/lunch_demo.xml',
    ],
    'qweb': [],
    'installable': True,
    'application': True,
    'certificate': '001292377792581874189',
}
