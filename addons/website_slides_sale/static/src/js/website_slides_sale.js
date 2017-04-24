odoo.define('website_slides_sale.website_slides_sale', function (require) {
"use strict";

var ajax = require('web.ajax');
var core = require('web.core');
var base = require('web_editor.base');

var _t = core._t;

$(document).ready(function() {
	var $course_form = $(".new_course_form");
	var $menus = $course_form.find(".sidebar .menu li");

	$menus.on("click", function(event) {
		event.preventDefault();
		$menus.removeClass("active");
		$(this).addClass("active");
		var id = $(this).find("a").attr("href").replace("#", "");
		var $page = $course_form.find("#"+id);
		var $previous_pages = $course_form.find(".course_page");
		$previous_pages.removeClass("show");
		$page.addClass("show");
	});

	var $active_menu = $menus.filter(function() {
		return $(this).hasClass("active");
	});
	if ($active_menu.length) {
		$active_menu.first().trigger("click");
	}

	$('textarea.load_editor').each(function () {
		var $textarea = $(this);
		var toolbar = [
                ['style', ['style']],
                ['font', ['bold', 'italic', 'underline', 'clear']],
                ['para', ['ul', 'ol', 'paragraph']],
                ['table', ['table']],
                ['history', ['undo', 'redo']],
                ['insert', ['link', 'picture']]
            ];
		$textarea.summernote({
	            height: 150,
	            toolbar: toolbar,
	            styleWithSpan: false
	        });
	    // $form.on('click', 'button, .a-submit', function () {
	    //     $textarea.html($form.find('.note-editable').code());
	    // });
	});

	// Course Learn Page
	var $course_content = $(".course_content");
	var $lecture_menus = $course_content.find(".o_lecture_menu");
	$lecture_menus.on("click", function(event) {
		event.preventDefault();
		$lecture_menus.removeClass("active");
		$(this).addClass("active");

		var lecture_id = $(this).data("lecture_id");
		ajax.jsonRpc('/web/dataset/call_kw', 'call', {
            model: 'course.lecture',
            method: 'search_read',
            args: [],
            kwargs: {
                domain: [['id', '=', parseInt(lecture_id)]],
                fields: [],
                limit: 1,
                order: 'id desc',
                context: base.get_context()
            }
        }).then(function(result) {
        	var res = result[0];

        	if (res.slide_type == 'presentation') {
        		var $static_iframe = $('<iframe src="http://localhost:8069/slides/embed/11?page=1" allowFullScreen="true" height="500" width="100%" frameborder="0"></iframe>');
        		$(".course_lecture_content").html($static_iframe);
        	}
        });
	});

});

});