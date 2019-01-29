odoo.define('survey.question', function (require) {
'use strict';

require('web.dom_ready');

var ajax = require('web.ajax');
var Widget = require('web.Widget');

if($('.js_surveyform').length) {
    var SurveyForm = Widget.extend({
        events: {
            'click .js_question-wrapper': '_onQuestionClick',
            'focusout .js_question-wrapper': '_onQuestionFocus',
        },

        _onQuestionClick: function (ev) {
            var hidden_question_ids = $("#"+ev.target.name);
            if(undefined !== hidden_question_ids && hidden_question_ids.length && ev.target.type == "radio" || ev.target.type == "checkbox" || ev.target.type == "select-one")
                this._do_hide_show(ev,"click");
        },

        _onQuestionFocus: function (ev) {
            var hidden_question_ids = $("#"+ev.target.name);
            if(undefined !== hidden_question_ids && hidden_question_ids.length && ev.target.type == "textarea" || ev.target.type == "text" || ev.target.type == "number" )
                this._do_hide_show(ev,"focus");
        },

        _do_hide_show: function(ev,event_passed){

             var hidden_question_ids = $("#"+ev.target.name).data('depend');
            if(undefined !== hidden_question_ids && hidden_question_ids.length){

                var survey_id = parseInt(ev.target.name.split("_")[0]);
                var page_id = parseInt(ev.target.name.split("_")[1]);
                var question_id = parseInt(ev.target.name.split("_")[2]);
                var answer_id = null;
                if(event_passed == "click"){
                    answer_id = parseInt(ev.target.value); // for checkbox/radio/select
                }else if(event_passed == "focus"){
                    answer_id = ev.target.value; // for text/textarea/date
                }
                ajax.jsonRpc('/web/dataset/call_kw', 'call', {
                    model: 'survey.question',
                    method: 'get_hidden_question',
                    args: [],
                    kwargs: {
                        s_id:survey_id,
                        p_id:page_id,
                        q_id:question_id,
                        ans_id:answer_id,
                    },
                }).then(function (res) {
                    res.forEach(function(element) {
                        var $hidden_question = $("#"+survey_id+"_"+page_id+"_"+element[0]);
                        if(!element[1])
                            $($hidden_question.children("input")[0]).val("");
                        $hidden_question.toggleClass('d-none', !element[1]);
                    });
                })
            }
        },
    });
    var surveyForm = new SurveyForm();
    surveyForm.attachTo($('.js_surveyform'));
}
});
