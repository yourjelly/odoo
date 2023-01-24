import xmlrpc.client
import datetime

from numpy.random import seed, normal, randint

#make this example reproducible
seed(1)

url = "http://localhost:8069/"
db = "SSTest"
username = 'admin'
password = 'admin'

common = xmlrpc.client.ServerProxy('{}/xmlrpc/2/common'.format(url))
uid = common.authenticate(db, username, password, {})

models = xmlrpc.client.ServerProxy('{}/xmlrpc/2/object'.format(url))
product_id = models.execute_kw(db, uid, password, 'product.product', 'create', [{
    'name': "Normal Distribution",
    'type': "product",
}])

month_transfers = normal(loc=40, scale=10, size=100)

moves_values = []
move_lines_values = []

for month in range(1, 13):
    transfers = int(month_transfers[0])
    month_transfers = month_transfers[1:]
    quantities = normal(loc=30, scale=20, size=transfers)
    for t in range(transfers):
        quantity = float(round(quantities[0]) * 100)/100
        if quantity < 0:
            quantity = 0.00
        quantities = quantities[1:]
        move_data = {
            'name': 'Test Normal Distribution',
            'date': "2022-%02d-%02d" % (month, randint(1, 28)),
            'product_id': product_id,
            'state': 'done',
            'company_id': 1,
            'location_id': 8,
            'location_dest_id': 5,
        }
        moves_values.append(move_data)
        move_lines_data = {
            'date': "2022-%02d-%02d" % (month, randint(1, 28)),
            'qty_done': quantity,
            'product_id': product_id,
            'state': 'done',
            'company_id': 1,
            'location_id': 8,
            'location_dest_id': 5,
        }
        move_lines_values.append(move_lines_data)

move_ids = models.execute_kw(db, uid, password, 'stock.move', 'create', [moves_values])
for ml, move_id in zip(move_lines_values, move_ids):
    ml['move_id'] = move_id
move_ids = models.execute_kw(db, uid, password, 'stock.move.line', 'create', [move_lines_values])


