odoo.define('website_slides_sale.website_slides_sale', function (require) {
"use strict";

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

});

});