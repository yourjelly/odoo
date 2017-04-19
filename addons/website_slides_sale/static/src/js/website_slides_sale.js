odoo.define('website_slides_sale.website_slides_sale', function (require) {
"use strict";

var $course_form = $(".new_course_form");

var $menus = $course_form.find(".sidebar .menu li");

$menus.on("click", function(event) {
	$(event.currentTarget).addClass("show");
});

var $active_menu = $menus.hasClass("active");

if ($active_menu.length) {
	$active_menu.trigger("click");
}

console.log("Inside website_slides_sale :::: ");

});