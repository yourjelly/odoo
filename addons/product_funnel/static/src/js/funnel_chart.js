odoo.define('product_funnel.chart_widget', function (require) {
"use strict";

var Widget = require('web.Widget');
var core = require('web.core');
var ajax = require('web.ajax');
var AbstractAction = require('web.AbstractAction');

var qweb = core.qweb;

var SelectionWidget = Widget.extend({
    template: 'selection_template',

    events: {
        'click .form-check-input': '_onClick',
        'change .form-control': '_onChange',
    },

    init: function(parent){
        this._super.apply(this, arguments);
        this.parent = parent;
        this.name = 'name';
    },

    willStart: function(){
        var self = this;
        var arg1 = this._super.apply(this, arguments);
        var arg2 = this._rpc({
                    route:'/list/value',
                    }).then(function(result){
                        self.value = result 
                    });
        return $.when(arg1, arg2);
    },

    start:function(){
        this.$(".selection").html(qweb.render('search_template',{values: this.value['product']}));
    },
    
    _onClick: function() {
        var select = this.$(".product").is(":checked") ? this.value['product'] : this.value['location'];
        this.name = this.$(".product").is(":checked") ? 'name' : 'location_name';
        this.$(".selection").html(qweb.render('search_template',{values: select}));
    },

    _onChange:function(){
        this.trigger_up('change_search_value', {'value': this.$(".form-control").val() , 'name': this.name});
    }

});

var FunnelChartWidget  = AbstractAction.extend({
    template: 'chart_template',

    jsLibs: [
        '/product_funnel/static/lib/d3.v3.min.js',
        '/product_funnel/static/lib/d3-funnel.js',
    ],

    custom_events:{
        change_search_value: '_onSearchData',
    },

    willStart:function(){
        return $.when(ajax.loadLibs(this), this._super.apply(this, arguments));
    },

    start:function(parent, options){
        this.selectionwidget = new SelectionWidget(this);
        this.selectionwidget.insertBefore(this.$el.find(".funnelchart"));
    },

    _onSearchData: function(event) {
        var self = this;
        this._rpc({
            route: '/search/product/',
            params: { 'search_by': event.data.value,
                      'name': event.data.name  }
        }).then(function (result) {
            $(".funnelchart").empty();
            var funnel = new D3Funnel(result);
            funnel.draw(".funnelchart");  
        });
    },
});

core.action_registry.add('funnelchart', FunnelChartWidget);

});
