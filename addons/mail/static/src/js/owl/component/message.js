odoo.define('mail.component.Message', function (require) {
'use strict';

const mailUtils = require('mail.utils');
const AttachmentList = require('mail.component.AttachmentList');

const time = require('web.time');

const { Component, connect } = owl;

class Message extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { AttachmentList };
        this.id = `message_${this.props.messageLocalId}`;
        this.state = {
            timeElapsed: mailUtils.timeFromNow(this.props.message.dateMoment),
            toggledClick: false
        };
        this.template = 'mail.component.Message';
        this._intervalId = undefined;
    }

    willUnmount() {
        clearInterval(this._intervalId);
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {string}
     */
    get avatar() {
        if (this.props.author && this.props.author === this.props.odoobot) {
            return '/mail/static/src/img/odoobot.png';
        } else if (this.props.author) {
            return `/web/image/res.partner/${this.props.author.id}/image_small`;
        } else if (this.props.message.message_type === 'email') {
            return '/mail/static/src/img/email_icon.png';
        }
        return '/mail/static/src/img/smiley/avatar.jpg';
    }

    /**
     * @return {boolean}
     */
    get bottomVisible() {
        const elRect = this.el.getBoundingClientRect();
        if (!this.el.parentNode) {
            return false;
        }
        const parentRect = this.el.parentNode.getBoundingClientRect();
        // bottom with (double) 5px offset
        return (
            elRect.bottom < parentRect.bottom + 5 &&
            parentRect.top < elRect.bottom + 5
        );
    }

    /**
     * @return {string}
     */
    get datetime() {
        return this.props.message.dateMoment.format(time.getLangDatetimeFormat());
    }

    /**
     * @return {string}
     */
    get displayedAuthorName() {
        if (this.props.author) {
            return this.props.author.displayName;
        }
        return this.props.message.email_from || this.env._t("Anonymous");
    }

    /**
     * @return {boolean}
     */
    get hasDifferentOriginThread() {
        return this.props.originThread && this.props.originThread !== this.props.thread;
    }

    /**
     * @return {boolean}
     */
    get partiallyVisible() {
        const elRect = this.el.getBoundingClientRect();
        if (!this.el.parentNode) {
            return false;
        }
        const parentRect = this.el.parentNode.getBoundingClientRect();
        // intersection with 5px offset
        return (
            elRect.top < parentRect.bottom + 5 &&
            parentRect.top < elRect.bottom + 5
        );
    }

    /**
     * @return {boolean}
     */
    get redirectAuthor() {
        if (!this.props.redirectAuthor) {
            return false;
        }
        if (!this.props.author) {
            return false;
        }
        if (this.props.author.id === this.env.session.partner_id) {
            return false;
        }
        return true;
    }

    /**
     * @return {string}
     */
    get shortTime() {
        return this.props.message.dateMoment.format('hh:mm');
    }

    /**
     * @return {boolean}
     */
    get starred() {
        return this.props.message.starred_partner_ids &&
            this.props.message.starred_partner_ids.includes(this.env.session.partner_id);
    }

    /**
     * @return {string}
     */
    get timeElapsed() {
        clearInterval(this._intervalId);
        this._intervalId = setInterval(() => {
            this.state.timeElapsed = mailUtils.timeFromNow(this.props.message.dateMoment);
        }, 60 * 1000);
        return this.state.timeElapsed;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {Object} [param0={}]
     * @param {string} [param0.behavior='auto']
     * @return {Promise}
     */
    scrollToVisibleBottom({ behavior='auto' }={}) {
        this.el.scrollIntoView({
            behavior,
            block: 'end',
            inline: 'nearest',
        });
        if (behavior === 'smooth') {
            return new Promise(resolve => setTimeout(resolve, 500));
        } else {
            return Promise.resolve();
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} param0
     * @param {integer} param0.id
     * @param {string} param0.model
     */
    _redirect({ id, model }) {
        this.trigger('redirect', { id, model });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        if (ev.target.closest('.o_mention')) {
            this.trigger('redirect', {
                id: Number(ev.target.dataset.oeId),
                model: ev.target.dataset.oeModel,
            });
            return;
        }
        if (ev.target.closest('.o_mail_redirect')) {
            this.trigger('redirect', {
                id: Number(ev.target.dataset.oeId),
                model: ev.target.dataset.oeModel,
            });
            ev.preventDefault();
            return;
        }
        ev.stopPropagation();
        this.state.toggledClick = !this.state.toggledClick;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickAuthor(ev) {
        if (!this.redirectAuthor) {
            return;
        }
        if (!this.props.author) {
            return;
        }
        this._redirect({
            id: this.props.author.id,
            model: this.props.author._model,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickOriginThread(ev) {
        this.trigger('redirect', {
            id: this.props.originThread.id,
            model: this.props.originThread._model,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickStar(ev) {
        return this.env.store.dispatch('toggleStarMessage', this.props.messageLocalId);
    }
}

/**
 * Props validation
 */
Message.props = {
    author: { type: Object, /* {mail.store.model.Partner} */ optional: true },
    message: Object, // {mail.store.model.Message}
    messageLocalId: String,
    originThread: { type: Object, /* {mail.store.model.Thread} */ optional: true },
    redirectAuthor: Boolean,
    squashed: Boolean,
    thread: Object, // {mail.store.model.Thread}
    threadLocalId: String,
};

Message.defaultProps = {
    redirectAuthor: false,
    squashed: false,
};

return connect(
    Message,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.messageLocalId
     * @param {string} ownProps.threadLocalId
     * @return {Object}
     */
    (state, ownProps) => {
        const message = state.messages[ownProps.messageLocalId];
        const attachmentLocalIds = message.attachmentLocalIds;
        const author = state.partners[message.authorLocalId];
        const odoobot = state.partners.odoobot;
        const originThread = state.threads[message.originThreadLocalId];
        const thread = state.threads[ownProps.threadLocalId];
        return {
            attachmentLocalIds,
            author,
            message,
            odoobot,
            originThread,
            thread,
        };
    },
    { deep: false }
);

});
