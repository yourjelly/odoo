odoo.define('website_recruitment', function (require) {
"use strict";

var ajax = require('web.ajax');
var core = require('web.core');
var base = require('web_editor.base');

var qweb = core.qweb;
var _t = core._t;

$(document).ready(function() {
    function select2_wrapper(tag, multi, fetch_fnc) {
        return {
            width: '100%',
            placeholder: tag,
            allowClear: true,
            formatNoMatches: false,
            multiple: multi,
            selection_data: false,
            fetch_rpc_fnc : fetch_fnc,
            formatSelection: function (data) {
                if (data.tag) {
                    data.text = data.tag;
                }
                return data.text;
            },
            createSearchChoice: function(term, data) {
                var added_tags = $(this.opts.element).select2('data');
                if (_.filter(_.union(added_tags, data), function(tag) {
                    return tag.text.toLowerCase().localeCompare(term.toLowerCase()) === 0;
                }).length === 0) {
                    return {
                        id: _.uniqueId('tag_'),
                        create: true,
                        tag: term,
                        text: _.str.sprintf(_t("Create new tag '%s'"), term),
                    };
                }
            },
            fill_data: function (query, data) {
                var that = this,
                    tags = {results: []};
                _.each(data, function (obj) {
                    if (that.matcher(query.term, obj.name)) {
                        tags.results.push({id: obj.id, text: obj.name });
                    }
                });
                query.callback(tags);
            },
            query: function (query) {
                var that = this;
                // fetch data only once and store it
                if (!that.selection_data) {
                    that.fetch_rpc_fnc().then(function (data) {
                        that.fill_data(query, data);
                        that.selection_data = data;
                    });
                } else {
                    this.fill_data(query, that.selection_data);
                }
            }
        };
    };
    $('#skill_ids').select2(select2_wrapper(_t('Skills'), true, function () {
        return ajax.jsonRpc("/web/dataset/call_kw", 'call', {
            model: 'recruitment.skills',
            method: 'search_read',
            args: [],
            kwargs: {
                fields: ['name'],
                context: base.get_context()
            }
        });
    }));

    $('textarea.load_editor').each(function () {
        var $textarea = $(this);
        
        var $form = $textarea.closest('form');
        var toolbar = [
                ['style', ['style']],
                ['font', ['bold', 'italic', 'underline', 'clear']],
                ['para', ['ul', 'ol', 'paragraph']],
                ['table', ['table']],
                ['history', ['undo', 'redo']],
            ];
        
        $textarea.summernote({
                height: 150,
                toolbar: toolbar,
                styleWithSpan: false
            });
        $form.on('click', 'button, .a-submit', function () {
            $textarea.html($form.find('.note-editable').code());
        });
    });

    // $("#publish_form").submit(function(e) {
    //     e.preventDefault();
    //     var res = [];
    //     _.each($('#skill_ids').select2('data'),
    //         function (val) {
    //             if (val.create) {
    //                 res.push([0, 0, {'name': val.text}]);
    //             } else {
    //                 res.push([4, val.id]);
    //             }
    //         });
        // var datas = {
        //     'name': $("[name='name']").val(),
        //     'what_we_offer': $("[name='what_we_offer']").val(),
        //     'responsibilities': $("[name='responsibilities']").val(),
        //     'nice_to_have': $("[name='nice_to_have']").val(),
        //     'must_have': $("[name='must_have']").val(),
        //     'skill_ids': res
        // };
        // ajax.jsonRpc("/jobs/publish", 'call', datas).then(function (result) {
        //     console.log("Hi I am get success :::::: ", result);
        //     //Call controller to redirect to other URL
        // });
    //})
});

});