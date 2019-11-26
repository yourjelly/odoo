odoo.define('survey.session_manage', function (require) {
'use strict';

var publicWidget = require('web.public.widget');

publicWidget.registry.SurveySessionManage = publicWidget.Widget.extend({
    selector: '.o_survey_session_manage',
    events: {
        'click .o_survey_session_next': '_onNextQuestionClick',
        'click .o_survey_session_end': '_onEndSessionClick',
        'click .o_survey_session_show_results': '_onShowResultsClick',
        'click .o_survey_session_hide_results': '_onHideResultsClick',
        'click .o_survey_session_show_ranking': '_onShowRankingClick',
        'click .o_survey_session_hide_ranking': '_onHideRankingClick',
        'click .o_survey_session_full_screen': '_onFullScreenClick',
        'click .o_survey_session_exit_full_screen': '_onExitFullScreenClick',
    },

    init: function () {
        this._super.apply(this, arguments);
    },

    start: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            self.surveyId = self.$el.data('surveyId');
            self.inputSessionId = self.$el.data('inputSessionId');

            var $timer = self.$('.o_survey_timer');
            if ($timer.length) {
                var timeLimitMinutes = self.$el.data('timeLimitMinutes');
                var timer = self.$el.data('timer');
                self.surveyTimerWidget = new publicWidget.registry.SurveyTimerWidget(self, {
                    'timer': timer,
                    'timeLimitMinutes': timeLimitMinutes
                });
                self.surveyTimerWidget.attachTo($timer);
            }
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
    *
    * @param {MouseEvent} ev
    * @private
    */
   _onNextQuestionClick: function (ev) {
       ev.preventDefault();

       this._rpc({
           model: 'survey.user_input_session',
           method: 'next_question',
           args: [[this.inputSessionId]],
       }).then(function () {
            var params = new URLSearchParams(document.location.search);
            params.delete('show_results');
            params.delete('show_ranking');
            document.location = document.location.pathname + '?' + params.toString();
       });
    },

    /**
    *
    * @param {MouseEvent} ev
    * @private
    */
   _onEndSessionClick: function (ev) {
       var self = this;
       ev.preventDefault();

       this._rpc({
           model: 'survey.user_input_session',
           method: 'action_end_session',
           args: [[this.inputSessionId]],
       }).then(function () {
           document.location = _.str.sprintf(
               '/survey/results/%s/%s',
               self.surveyId,
               self.inputSessionId
            );
       });
    },

    /**
    *
    * @param {MouseEvent} ev
    * @private
    */
   _onShowResultsClick: function (ev) {
        ev.preventDefault();

        var params = new URLSearchParams(document.location.search);
        params.set('show_results', true);
        document.location = document.location.pathname + '?' + params.toString();
    },

    /**
    *
    * @param {MouseEvent} ev
    * @private
    */
   _onHideResultsClick: function (ev) {
        ev.preventDefault();

        var params = new URLSearchParams(document.location.search);
        params.delete('show_results');
        document.location = document.location.pathname + '?' + params.toString();
    },

    /**
    *
    * @param {MouseEvent} ev
    * @private
    */
   _onShowRankingClick: function (ev) {
        ev.preventDefault();

        var params = new URLSearchParams(document.location.search);
        params.set('show_ranking', true);
        document.location = document.location.pathname + '?' + params.toString();
    },

    /**
    *
    * @param {MouseEvent} ev
    * @private
    */
   _onHideRankingClick: function (ev) {
        ev.preventDefault();

        var params = new URLSearchParams(document.location.search);
        params.delete('show_ranking');
        document.location = document.location.pathname + '?' + params.toString();
    },

    /**
    *
    * @param {MouseEvent} ev
    * @private
    */
    _onFullScreenClick: function (ev) {
        ev.preventDefault();

        var element = document.documentElement;
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        }

        this.$('.o_survey_session_full_screen').addClass('d-none');
        this.$('.o_survey_session_exit_full_screen').removeClass('d-none');
    },

    /**
    *
    * @param {MouseEvent} ev
    * @private
    */
    _onExitFullScreenClick: function (ev) {
        ev.preventDefault();

        document.exitFullscreen();

        this.$('.o_survey_session_full_screen').removeClass('d-none');
        this.$('.o_survey_session_exit_full_screen').addClass('d-none');
    },
});

return publicWidget.registry.SurveySessionManage;

});
