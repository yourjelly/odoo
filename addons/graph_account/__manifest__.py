{
    'name': "Graph Account",

    'summary': """We are providing Balance Graph""",

    'description': """We provide the records of the balance""",

    'author': "Graph Account",
    'website': "http://www.graph.com",

    'version': '0.1',

    'depends': ['account'],

    'data': [
        'views/varun_customers_view.xml',
    ],

    'qweb': [
         "static/src/xml/dialog.xml",
    ],
}
