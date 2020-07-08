odoo.define('website_blog.new_blog_post', function (require) {
'use strict';

var core = require('web.core');
var wUtils = require('website.utils');
var WebsiteNewMenu = require('website.newMenu');

var _t = core._t;

WebsiteNewMenu.include({
    actions: _.extend({}, WebsiteNewMenu.prototype.actions || {}, {
        new_blog_post: '_createNewBlogPost',
    }),

    //--------------------------------------------------------------------------
    // Actions
    //--------------------------------------------------------------------------

    /**
     * Asks the user information about a new blog post to create, then creates
     * it and redirects the user to this new post.
     *
     * @private
     * @returns {Promise} Unresolved if there is a redirection
     */
    _createNewBlogPost: function () {
        return this._rpc({
            model: 'blog.blog',
            method: 'search_read',
            args: [wUtils.websiteDomain(this), ['name']],
        }).then(function (blogs) {
            if (blogs.length === 1) {
                document.location = '/blog/' + blogs[0]['id'] + '/post/new';
                return new Promise(function () {});
            } else if (blogs.length > 1) {
                return wUtils.prompt({
                    id: 'editor_new_blog',
                    window_title: _t("New Blog Post"),
                    select: _t("Select Blog"),
                    init: function (field) {
                        return _.map(blogs, function (blog) {
                            return [blog['id'], blog['name']];
                        });
                    },
                }).then(function (result) {
                    var blog_id = result.val;
                    if (!blog_id) {
                        return;
                    }
                    document.location = '/blog/' + blog_id + '/post/new';
                    return new Promise(function () {});
                });
            }
        });
    },
});
});

//==============================================================================

odoo.define('website_blog.editor', function (require) {
'use strict';

require('web.dom_ready');
const {qweb, _t} = require('web.core');
const options = require('web_editor.snippets.options');
var WysiwygMultizone = require('web_editor.wysiwyg.multizone');

if (!$('.website_blog').length) {
    return Promise.reject("DOM doesn't contain '.website_blog'");
}

WysiwygMultizone.include({
    custom_events: Object.assign({}, WysiwygMultizone.prototype.custom_events, {
        'set_blog_post_update_data': '_onSetBlogPostUpdateData',
    }),

    /**
     * @override
     */
    init() {
        this._super(...arguments);
        this.blogTagsPerBlogPost = {};
    },
    /**
     * @override
     */
    async start() {
        await this._super(...arguments);
        $('.js_tweet, .js_comment').off('mouseup').trigger('mousedown');
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    async save() {
        const _super = this._super.bind(this);
        await this._saveBlogTags();
        return _super(...arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Saves the blog tags in the database.
     *
     * @private
     */
    async _saveBlogTags() {
        for (const [blogPostID, data] of Object.entries(this.blogTagsPerBlogPost)) {
            const additionsProms = data.additions.map(tag => {
                if (typeof tag.id === 'string') {
                    return this._rpc({
                        model: 'blog.tag',
                        method: 'create',
                        args: [{
                            'name': tag.name,
                            'post_ids': [blogPostID],
                        }],
                    });
                } else {
                    return this._rpc({
                        model: 'blog.tag',
                        method: 'write',
                        args: [tag.id, {
                            'post_ids': [[4, blogPostID, 0]],
                        }],
                    });
                }
            });
            const removalProms = data.removals.map(tag => {
                return this._rpc({
                    model: 'blog.tag',
                    method: 'write',
                    args: [tag.id, {
                        'post_ids': [[3, blogPostID, 0]],
                    }],
                });
            });
            await Promise.all(additionsProms);
            await Promise.all(removalProms);
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onSetBlogPostUpdateData: function (ev) {
        this.blogTagsPerBlogPost[ev.data.blogPostID] = {
            additions: ev.data.blogTagsAdditions,
            removals: ev.data.blogTagsRemovals,
        };
    },
});

options.registry.many2one.include({

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _selectRecord: function ($opt) {
        var self = this;
        this._super.apply(this, arguments);
        if (this.$target.data('oe-field') === 'author_id') {
            var $nodes = $('[data-oe-model="blog.post"][data-oe-id="'+this.$target.data('oe-id')+'"][data-oe-field="author_avatar"]');
            $nodes.each(function () {
                var $img = $(this).find('img');
                var css = window.getComputedStyle($img[0]);
                $img.css({ width: css.width, height: css.height });
                $img.attr('src', '/web/image/res.partner/'+self.ID+'/image_1024');
            });
            setTimeout(function () { $nodes.removeClass('o_dirty'); },0);
        }
    }
});

options.registry.CoverProperties.include({
    /**
     * @override
     */
    updateUI: async function () {
        await this._super(...arguments);
        var isRegularCover = this.$target.is('.o_wblog_post_page_cover_regular');
        var $coverFull = this.$el.find('[data-select-class*="o_full_screen_height"]');
        var $coverMid = this.$el.find('[data-select-class*="o_half_screen_height"]');
        var $coverAuto = this.$el.find('[data-select-class*="cover_auto"]');
        this._coverFullOriginalLabel = this._coverFullOriginalLabel || $coverFull.text();
        this._coverMidOriginalLabel = this._coverMidOriginalLabel || $coverMid.text();
        this._coverAutoOriginalLabel = this._coverAutoOriginalLabel || $coverAuto.text();
        $coverFull.children('div').text(isRegularCover ? _t("Large") : this._coverFullOriginalLabel);
        $coverMid.children('div').text(isRegularCover ? _t("Medium") : this._coverMidOriginalLabel);
        $coverAuto.children('div').text(isRegularCover ? _t("Tiny") : this._coverAutoOriginalLabel);
    },
});

const NEW_TAG_PREFIX = 'new-blog-tag-';

options.registry.BlogPostTagSelection = options.Class.extend({
    xmlDependencies: (options.Class.prototype.xmlDependencies || [])
        .concat(['/website_blog/static/src/xml/website_blog_tag.xml']),

    /**
     * @override
     */
    async willStart() {
        await this._super(...arguments);
        this.blogPostID = parseInt(this.$target[0].dataset.blogId);
        this.isEditingTags = false;
        this.allTags = await this._rpc({
            model: 'blog.tag',
            method: 'search_read',
            args: [[], ['id', 'name', 'post_ids']],
        });
        this.tagIDs = this.allTags.filter(tag => {
            return tag['post_ids'].includes(this.blogPostID);
        });
    },
    /**
     * @override
     */
    cleanForSave() {
        if (this.isEditingTags) {
            this._notifyUpdatedTags();
        }
    },

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * @see this.selectClass for params
     */
    editTagList(previewMode, widgetValue, params) {
        this._toggleEditUI(true);
    },
    /**
     * Send changes that will be saved in the database.
     *
     * @see this.selectClass for params
     */
    saveTagList(previewMode, widgetValue, params) {
        this._toggleEditUI(false);
        this._notifyUpdatedTags();
    },
    /**
     * @see this.selectClass for params
     */
    setNewTagName(previewMode, widgetValue, params) {
        this.newTagName = widgetValue;
    },
    /**
     * @see this.selectClass for params
     */
    confirmNew(previewMode, widgetValue, params) {
        if (!this.newTagName) {
            return;
        }
        const existing = this.allTags.some(tag => tag.name.toLowerCase() === this.newTagName.toLowerCase());
        if (existing) {
            return this.displayNotification({
                type: 'warning',
                message: _t("This tag already exists"),
            });
        }
        const newTag = {
            'id': _.uniqueId(NEW_TAG_PREFIX),
            'name': this.newTagName,
        };
        this.allTags.push(newTag);
        this.tagIDs.push(newTag);
        this.newTagName = '';
        this.rerender = true;
    },
    /**
     * @see this.selectClass for params
     */
    addTag(previewMode, widgetValue, params) {
        const tagID = parseInt(widgetValue);
        const tag = this.allTags.find(tag => tag.id === tagID);
        this.tagIDs.push(tag);
        this.rerender = true;
    },
    /**
     * @see this.selectClass for params
     */
    removeTag(previewMode, widgetValue, params) {
        this.tagIDs = this.tagIDs.filter(tag => (`${tag.id}` !== widgetValue));
        if (widgetValue.startsWith(NEW_TAG_PREFIX)) {
            this.allTags.filter(tag => tag.id !== widgetValue);
        }
        this.rerender = true;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    async updateUI() {
        if (this.rerender) {
            this.rerender = false;
            await this._rerenderXML();
            return;
        }
        return this._super(...arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _notifyUpdatedTags() {
        this.trigger_up('set_blog_post_update_data', {
            blogPostID: this.blogPostID,
            blogTagsAdditions: this.blogTagsAdditions,
            blogTagsRemovals: this.blogTagsRemovals,
        });
    },
    /**
     * @override
     */
    _renderCustomXML: async function (uiFragment) {
        const $tagList = $(uiFragment.querySelector('[data-name="tag_list"]'));
        const $select = $(uiFragment.querySelector('[data-name="add_tag_opt"] we-select'));
        for (const tag of this.tagIDs) {
            $tagList.append(qweb.render('website_blog.tagListItem', {
                tag: tag,
                isEditingTags: this.isEditingTags,
            }));
        }
        const availableTags = this.allTags.filter(tag => !this.tagIDs.includes(tag));
        for (const tag of availableTags) {
            $select.prepend(qweb.render('website_blog.tagSelectItem', {
                tag: tag,
                isEditingTags: this.isEditingTags,
            }));
        }
    },
    /**
     * Toggles the UI between read/edit mode.
     *
     * @private
     * @param {boolean} edit
     */
    _toggleEditUI: function (edit) {
        this.isEditingTags = edit;
        const $editMenu = $('[data-name="add_tag_opt"]');
        $editMenu.toggleClass('d-none', !this.isEditingTags);
        this.$el.find('.o_we_edit_tag_btn').toggleClass('d-none', this.isEditingTags);
        this.$el.find('.o_we_save_tag_btn').toggleClass('d-none', !this.isEditingTags);
        this.rerender = true;
    },
});
});
