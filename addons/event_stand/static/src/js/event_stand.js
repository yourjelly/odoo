odoo.define('website_event_track.website_event_track', function (require) {
"use strict";

  $(document).ready(function() {

    var ajax = require('web.ajax');

    function update_total_data(data){
        var quantity = parseInt($('#slot_number').val());
        var total = data.price + data.price_upsell * (quantity-1);
        $('.o_total').html(total);
        $('.o_total_one').html(data.price);
        $('.o_total_upsell').html(data.price_upsell);
        $('.o_product_price').html(data.price_product * quantity);
        $('.o_total_balance').html(total - data.price_product);
    }
    function update_total() {
        var type_id = $("input[type=radio][name=type_id]:checked");
        ajax.jsonRpc("/event/exhibitors/onchange", 'call', {
            'type_id': parseInt(type_id.val()), 'stand_id': false
        }).then(update_total_data);
    }

    function update_data(event){
        var type_id = $("input[type=radio][name=type_id]:checked");
        var stand_id;
        if (event.data.refresh_stands) {
            stand_id = false;
        } else {
            stand_id = parseInt($("select#stand_id").val());
        }
        ajax.jsonRpc("/event/exhibitors/onchange", 'call', {'type_id': parseInt(type_id.val()), 'stand_id': stand_id})
            .then(function (data) {
                $('#stand-description').html(data.description);
                if (data.show_slot) {
                    // Update Slots
                    $('.slots,.o_add').show();
                    var opt = data.slots.map(function(x) {
                       if (x[2]) {
                           return '<option value="'+x[0]+'">'+x[1]+'</option>\n';
                       }
                       return '<option value="'+x[0]+'" disabled="1">'+x[1]+' (sold)</option>\n';
                    });
                    $('select.slot_id').html(opt.join('\n'));
                } else {
                    $('.slots,.o_add').hide();
                    $('#slot_number').val(1);
                    $('.o_extra_slot').remove();
                }

                // Update Stands
                if (event.data.refresh_stands) {
                    var opt = data.stands.map(function(x) {
                       if (x[2]) {
                           return '<option value="'+x[0]+'">'+x[1]+'</option>\n';
                       }
                       return '<option value="'+x[0]+'" disabled="1">'+x[1]+' (sold)</option>\n';
                    });
                    $('select#stand_id').html(opt.join('\n'));
                }
                update_total_data(data);
            });
        // event.preventDefault();
    };

    if ($("#exhibitor-registration")) {
        update_data({data: {refresh_stands: true}});
        $("input.o_type_id").change({refresh_stands: true}, update_data);
        $("select#stand_id").change({refresh_stands: false}, update_data);
        $("a#o_add_track").on('click', function(event){
            $('#slot_number').val( parseInt($('#slot_number').val())+1 )
            var self = $('#main_slot .slots:first').clone()
                .addClass('o_extra_slot').appendTo('#main_slot');
            self.append('<div class="col-md-2 mt8"><a href="#" class="o_close"><b>&times;</b></a></div>')
                .find('.o_close').click(function(event){
                    $('#slot_number').val( parseInt($('#slot_number').val())-1 );
                    self.remove();
                    update_total();
                    event.preventDefault();
                });
            update_total();

            $('.track_title').each(function (index) {
                $(this).attr('name', 'track_title_'+index);
            });
            $('.slot_id').each(function (index) {
                $(this).attr('name', 'slot_id_'+index);
            });
            event.preventDefault();
        });
    }


  });

});
