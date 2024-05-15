{
	'name':'Registers',
	'owner': "Divyesh Vyas ( divyeshvyas562@gmail.com )",
	'summary': 'Track leads and close opportunities',
	'version' : '1.2',
	'depends': [],
    'data':[
		# 'data/ir_cron.xml',
		'security/ir.model.access.csv', 
        
		'views/outward_register_view.xml',
		'views/inward_register_view.xml',
		'views/deadstock_register_view.xml',
		'views/scrap_register_view.xml',
		'views/general_purchase_register.xml',
		'views/consumable_register_view.xml',
		'views/fitter_expandable_register.xml',
		'views/voucher_register_view.xml'
		# 'views/student_menus.xml'
	],
	'assets': {
		'web.assets_backend': [
			'registers/static/src/scss/*.scss',		]
	},
    'application' : True

}
