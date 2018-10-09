odoo.define('job_seeker_chart.widgets', function (require) {
    "use strict";

    var core = require('web.core');
    var ajax = require('web.ajax');
    var Widget = require('web.Widget');
    var Dialog = require('web.Dialog');
    var AbstractAction = require('web.AbstractAction');

    var _t = core._t;
    var QWeb = core.qweb;

    var jobSeekerWidget = Widget.extend({
        template: 'job_seeker_widget_template',
        events: {
            'click .choice_radio': '_OnRadioChanged',
            'change #choice_select': '_GenerateGraph',
        },
        init: function (parent) {
            this.parent = parent;
            this._super.apply(this, arguments);
            this.response = {};
            this.isLocationSelected = false;
        },
        willStart: function () {
            var self = this;
            var df1 = this._super.apply(this, arguments);
            var df2 = this._rpc({
                route:  '/prefill_data'
            }).then(function (count) {
                self.response = count;
            });
            return $.when(df1,df2);
        },
        start: function () {
            this._OnRadioChanged();
        },
        _OnRadioChanged: function () {
            var radio = this.$el.find("input[name='search_by']:checked").val();
            this.choice = (radio == 'location') ? this.response['city'] : this.response['job_profile'];
            this.isLocationSelected = (radio == 'location') ? true : false;
            this.$el.find('#choose_one').html(QWeb.render("job_seeker_dropdown_data", {widget: this}));
            this.$el.find('#choice_select').change();
        },
        _GenerateGraph: function () {
            this.trigger_up('showGraph', {
                selectedChoiceVal: this.$el.find("#choice_select").val(),
                isLocationSelected: this.isLocationSelected
            });
        },
    });

    var jobSeekerChart = AbstractAction.extend({
        template: 'job_seeker_graph_template',
        jsLibs: [
            '/job_seeker_chart/static/src/js/d3.min.js',
            '/job_seeker_chart/static/src/js/d3pie.js',
        ],
        cssLibs: [
            '/job_seeker_chart/static/src/css/style.css',
        ],
        custom_events: {
            showGraph: '_OnBtnPressed',
        },
        start: function () {
            var tempvar = new jobSeekerWidget(this);
            tempvar.prependTo(this.$el.find("#prependTo"));
        },
        willStart: function() {
            return $.when(ajax.loadLibs(this), this._super.apply(this, arguments));
        },
        _OnBtnPressed: function (event) {
            var self = this;
            var colors_arr = ["#2484c1", "#65a620", "#7b6888", "#a05d56", "#961a1a", "#d8d23a", "#e98125", "#d0743c", "#635222", "#6ada6a", "#0c6197", "#7d9058", "#207f33", "#44b9b0", "#bca44a", "#e4a14b", "#a3acb2", "#8cc3e9", "#69a6f9", "#5b388f", "#546e91", "#8bde95", "#d2ab58", "#273c71", "#98bf6e", "#4daa4b", "#98abc5", "#cc1010", "#31383b", "#006391", "#c2643f", "#b0a474", "#a5a39c", "#a9c2bc", "#22af8c", "#7fcecf", "#987ac6", "#3d3b87", "#b77b1c", "#c9c2b6", "#807ece", "#8db27c", "#be66a2", "#9ed3c6", "#00644b", "#005064", "#77979f", "#77e079", "#9c73ab", "#1f79a7"]; // 50 colors
            this._rpc({
                route:  '/create_graph',
                params: {
                    'search_term': event.data.selectedChoiceVal,
                    'search_by_location': event.data.isLocationSelected
                },
            }).then(function (count) {
                if (self.$el.find("#pieChart").find()) {
                    $("#pieChart").empty();
                }
                if ($.isEmptyObject(count)) {
                    if (event.data.isLocationSelected) {
                        return Dialog.alert(self, _t("No candidates applied from " + event.data.selectedChoiceVal), {
                            title: _t('Sorry'),
                        });
                    } else {
                        return Dialog.alert(self, _t("No candidates applied for " + event.data.selectedChoiceVal), {
                            title: _t('Sorry'),
                        });
                    }
                }
                var graph_data = [];
                for (var key in count) {
                    graph_data.push({
                        "label": key,
                        "value": count[key],
                        "color": colors_arr[Math.floor(Math.random() * 50)] // 0 - 49 (we've 50 different colors)
                    });
                }
                var subtitle_text = (event.data.isLocationSelected) ? _t("Candidate(s) from ") + event.data.selectedChoiceVal : _t("Candidate(s) for ") + event.data.selectedChoiceVal;
                var tooltips_string = (event.data.isLocationSelected) ? _t("{value} Candidate(s) applied for {label} ({percentage}%)") : _t("{value} Candidate(s) applied from {label} ({percentage}%)");
                var pie = new d3pie("pieChart", {
                    "header": {
                        "title": {
                            "text": "Candidates applied for Job",
                            "fontSize": 22,
                            "font": "open sans"
                        },
                        "subtitle": {
                            "text": subtitle_text,
                            "color": "#888888",
                            "fontSize": 15,
                            "font": "open sans"
                        },
                        "titleSubtitlePadding": 9
                    },
                    "footer": {
                        "color": "#999999",
                        "fontSize": 10,
                        "font": "open sans",
                        "location": "bottom-left"
                    },
                    "size": {
                        "canvasHeight": 603,
                        "canvasWidth": 603,
                        "pieOuterRadius": "72%"
                    },
                    "data": {
                        "sortOrder": "value-asc",
                        "content": graph_data
                    },
                    "labels": {
                        "outer": {
                            "format": "label-value2",
                            "pieDistance": 32
                        },
                        "inner": {
                            "hideWhenLessThanPercentage": 3
                        },
                        "mainLabel": {
                            "fontSize": 12
                        },
                        "percentage": {
                            "color": "#ffffff",
                            "decimalPlaces": 0
                        },
                        "value": {
                            "color": "#6d6d6d",
                            "fontSize": 12
                        },
                        "lines": {
                            "enabled": true,
                            "style": "straight"
                        },
                        "truncation": {
                            "enabled": true
                        }
                    },
                    "tooltips": {
                        "enabled": true,
                        "type": "placeholder",
                        "string": tooltips_string,
                        "styles": {
                            "fadeInSpeed": 236,
                            "backgroundOpacity": 0.65
                        }
                    },
                    "effects": {
                        "pullOutSegmentOnClick": {
                            "effect": "linear",
                            "speed": 400,
                            "size": 8
                        }
                    },
                    "misc": {
                        "gradient": {
                            "enabled": true,
                            "percentage": 100
                        }
                    },
                    "callbacks": {}
                });
            });
        },
    });

    core.action_registry.add('job_seeker_widget', jobSeekerChart);
});
