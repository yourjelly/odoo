odoo.define('im_livechat.chatbot_script_questions', function (require) {
"use strict";

var core = require('web.core');
var _t = core._t;
var FormController = require('web.FormController');
var FieldMany2ManyTags = require('web.relational_fields').FieldMany2ManyTags;
var FieldOne2Many = require('web.relational_fields').FieldOne2Many;
var FieldRegistry = require('web.field_registry');
var dialogs = require('web.view_dialogs');

var ChatbotScriptQuestionsOne2Many = FieldOne2Many.extend({
     _onAddRecord: function (ev) {
        var self = this;
        var fnSuper = this._super;
        var fnArguments = arguments;
        ev.data = { 'disable_multiple_selection': false };
        // ensures the survey exists
        this.trigger_up('save_form_before_new_question', {
            callback: function () { fnSuper.apply(self, fnArguments); }
        });
    },
});

FieldRegistry.add('chatbot_script_questions', ChatbotScriptQuestionsOne2Many);

var ChatBotScriptQuestionTriggeringAnswers = FieldMany2ManyTags.extend({
    _renderEdit: function () {
        this._super(...arguments);

        if (this.many2one) {
            this.many2one.additionalContext.force_domain_chatbot_id = this._getChatbotId();
        }
    },

    _getChatbotId: function () {
        var chatbotForm = this._findChatbotForm();
        if (chatbotForm) {
            return chatbotForm.model.localData[chatbotForm.handle].res_id;
        } else {
            return false;
        }
    },

    _findChatbotForm: function (previousParent) {
        var parent = previousParent ? previousParent.getParent() : this.getParent();
        if (parent.modelName === "im_livechat.chatbot.bot") {
            return parent;
        } else {
            return this._findChatbotForm(parent);
        }
    }
});

FieldRegistry.add('chatbot_script_question_triggering_answers', ChatBotScriptQuestionTriggeringAnswers);

var ChatbotBotFormController = FormController.extend({
    custom_events: _.extend({}, FormController.prototype.custom_events, {
        save_form_before_new_question: '_saveFormBeforeNewQuestion',
    }),

    _saveFormBeforeNewQuestion: async function (ev) {
        // Run this pipeline synchronously before opening editor form to update/create
        await this.saveRecord(null, {
            stayInEdit: true
        });

        if (ev && ev.data.callback) {
            ev.data.callback();
        }
    },

    _onOpenOne2ManyRecord: async function (ev) {
        ev.stopPropagation();
        var data = ev.data;
        var record;
        if (data.id) {
            record = this.model.get(data.id, {raw: true});
        }

        // Sync with the mutex to wait for potential onchanges
        await this.model.mutex.getUnlockedDef();

        var previousOnSaved = data.on_saved;

        this._saveFormBeforeNewQuestion();
        new dialogs.FormViewDialog(this, {
            context: data.context,
            domain: data.domain,
            fields_view: data.fields_view,
            model: this.model,
            on_saved: (record) => {
                previousOnSaved(record);
                this._saveFormBeforeNewQuestion();
            },
            on_remove: data.on_remove,
            parentID: data.parentID,
            readonly: data.readonly,
            editable: data.editable,
            deletable: record ? data.deletable : false,
            disable_multiple_selection: data.disable_multiple_selection,
            recordID: record && record.id,
            res_id: record && record.res_id,
            res_model: data.field.relation,
            shouldSaveLocally: true,
            title: (record ? _t("Open: ") : _t("Create ")) + (ev.target.string || data.field.string),
        }).open();
    },
});

var FormRenderer = require('web.FormRenderer');
var FormView = require('web.FormView');
var viewRegistry = require('web.view_registry');

var ChatBotFormView = FormView.extend({
    config: _.extend({}, FormView.prototype.config, {
        Controller: ChatbotBotFormController,
        Renderer: FormRenderer,
    }),
});

viewRegistry.add('chatbot_bot_view_form', ChatBotFormView);

});
