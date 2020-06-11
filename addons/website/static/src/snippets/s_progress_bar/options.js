odoo.define('website.s_progress_bar_options', function (require) {
'use strict';

const core = require('web.core');
const utils = require('web.utils');
const snippetOptions = require('web_editor.snippets.options');

const _t = core._t;

snippetOptions.registry.progress = snippetOptions.SnippetOptionWidget.extend({

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Changes the position of the progressbar text.
     *
     * @see this.selectClass for parameters
     */
    display: async function (previewMode, widgetValue, params) {
        await this.wysiwyg.execBatch(async () => {
            // retro-compatibility

            let $text = this.$target.find('.s_progress_bar_text');

            // todo: Test this.
            if (this.$target.hasClass('progress')) {
                this.$target.removeClass('progress');
                await this.editorDom.removeClass({
                    domNode: this.$target[0],
                    class: 'progress',
                });
                await this.editorDom.wrap({
                    domContainer: this.$target.find('.progress-bar')[0],
                    html: $('<div/>', {
                        class: 'progress',
                    })[0].outerHTML,
                });
                await this.editorDom.addClass({
                    domNode: this.$target.find('.progress-bar span')[0],
                    class: 's_progress_bar_text',
                });
            }

            await this.editorDom.remove({
                domNode: $text[0].childNodes[0],
            });
            if (!$text.length) {
                $text = $('<span/>').addClass('s_progress_bar_text').html(_t('80% Development'));
            }


            if (widgetValue === 'inline') {
                await this.editorDom.insertHtml(
                    {
                        html: $text[0].outerHTML,
                        domNode: this.$target.find('.progress-bar')[0],
                        position: 'INSIDE',
                    }
                );
            } else {
                await this.editorDom.insertHtml(
                    {
                        html: $text[0].outerHTML,
                        domNode: this.$target.find('.progress')[0],
                        position: 'BEFORE',
                    }
                );
            }
        });
    },
    /**
     * Sets the progress bar value.
     *
     * @see this.selectClass for parameters
     */
    progressBarValue: async function (previewMode, widgetValue, params) {
        await this.wysiwyg.execBatch(async () => {
            let value = parseInt(widgetValue);
            value = utils.confine(value, 0, 100);
            const $progressBar = this.$target.find('.progress-bar');
            const $progressBarText = this.$target.find('.s_progress_bar_text');
            // Target precisely the XX% not only XX to not replace wrong element
            // eg 'Since 1978 we have completed 45%' <- don't replace 1978
            const previousProgressChildNodes = $progressBarText[0].childNodes[0];
            $progressBarText.text($progressBarText.text().replace(/[0-9]+%/, value + '%'));
            const replacedText = $progressBarText[0].outerHTML;
            await this.editorDom.replace({
                domNodes: previousProgressChildNodes,
                html: replacedText
            });
            await this.editorDom.setStyle({
                domNode: $progressBar[0],
                name: 'width',
                value: value + "%",
            });
            await this.editorDom.setAttribute({
                domNode: $progressBar[0],
                name: 'aria-valuenow',
                value: '' + value,
            });
        });
            const $progressBar = this.$target.find('.progress-bar');
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _computeWidgetState: function (methodName, params) {
        switch (methodName) {
            case 'display': {
                const isInline = this.$target.find('.s_progress_bar_text')
                                        .parent('.progress-bar').length;
                return isInline ? 'inline' : 'below';
            }
            case 'progressBarValue': {
                return this.$target.find('.progress-bar').attr('aria-valuenow') + '%';
            }
        }
        return this._super(...arguments);
    },
});
});
