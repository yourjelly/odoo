odoo.define('website_event_track.website_event_track', function (require) {
"use strict";

$(document).ready(function() {

	var ajax = require('web.ajax');
	function update_data(ev){
		var type_id = $("input[type=radio][name=type_id]:checked" ).val();
		var stand_id = $("select#stand_id" ).val();

		ajax.jsonRpc("/event/exhibitors/onchange", 'call', {'type_id': parseInt(type_id), 'stand_id': parseInt(stand_id)})
			.then(function (data) {
				$('#stand-description').html(data.description);
				if (data.show_slot) {
					$('#slots').show();
				} else {
					$('#slots').hide();
				}
				if (ev.data.refresh_stands) {
					var opt = data.stands.map(function(x) {
					   return '<option value="'+x[0]+'">'+x[1]+'</option>\n';
					});
					$('select#stand_id').html(opt.join('\n'));
				}
				
				
				console.log( data);

			});
        event.preventDefault();
    };

    $("#exhibitor-registration input.o_type_id").change({refresh_stands: true}, update_data);
    $("#exhibitor-registration select#stand_id").change({refresh_stands: false}, update_data);


});

});
