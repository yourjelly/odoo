/** @odoo-module **/

import { registry } from "@web/core/registry";

function assertEqual(actual, expected) {
    if (actual !== expected) {
        throw new Error(`Assert failed: expected: ${expected} ; got: ${actual}`);
    }
}

function logout() {
    return [
        {
            content: "check we're logged in",
            trigger: ".o_user_menu .dropdown-toggle",
            run: "click",
        },
        {
            content: "click the Log out button",
            trigger: ".dropdown-item[data-menu=logout]",
            run: "click",
        },
    ];
}

registry.category("web_tour.tours").add("test_user_switch", {
    test: true,
    url: "/web",
    steps: () => [
        ...logout(),
        {
            content: "Check that we're back on the quick login page",
            trigger: ".o_user_switch",
            run() {
                const users = document.querySelectorAll(".o_user_avatar");
                assertEqual(users.length, 1);
                assertEqual(
                    users[0].parentElement.querySelector(".fs-5").innerText.trim(),
                    "Marc Demo"
                );
                users[0].click();
            },
        },
        {
            content: "Check back button to back on the quick login page",
            trigger: ".oe_login_form .o_back_button",
            run: "click",
        },
        {
            content: "Display the login form",
            trigger: ".o_user_switch .fa-user-circle-o",
            run: "click",
        },
        {
            content: "fill the login",
            trigger: "input#login",
            run: "edit admin",
        },
        {
            content: "fill the password",
            trigger: "input#password",
            run: "edit admin",
        },
        {
            content: "click on login button",
            trigger: 'button:contains("Log in")',
            run: "click",
        },
        ...logout(),
        {
            content: "Choice demo",
            trigger: ".o_user_switch",
            run() {
                const users = document.querySelectorAll(".o_user_avatar");
                assertEqual(users.length, 2);
                assertEqual(
                    users[0].parentElement.querySelector(".fs-5").innerText.trim(),
                    "Mitchell Admin"
                );
                assertEqual(
                    users[1].parentElement.querySelector(".fs-5").innerText.trim(),
                    "Marc Demo"
                );
                users[1].click();
            },
        },
        {
            content: "check the login for demo",
            trigger: "input#login",
            run() {
                assertEqual(this.anchor.value, "demo");
            },
        },
        {
            content: "fill the password",
            trigger: "input#password",
            run: "edit demo",
        },
        {
            content: "Check back button to back on the quick login page",
            trigger: ".oe_login_form .o_back_button",
            run: "click",
        },
        {
            content: "Choice admin",
            trigger: ".o_user_switch",
            run() {
                const users = document.querySelectorAll(".o_user_avatar");
                assertEqual(users.length, 2);
                users[0].click();
            },
        },
        {
            content: "check the login for admin",
            trigger: "input#login",
            run() {
                assertEqual(this.anchor.value, "admin");
            },
        },
        {
            content: "fill the password",
            trigger: "input#password",
            run: "edit admin",
        },
        {
            content: "Check back button to back on the quick login page",
            trigger: ".oe_login_form .o_back_button",
            run: "click",
        },
        {
            content: "Display the login form",
            trigger: ".o_user_switch .fa-user-circle-o",
            run: "click",
        },
        {
            content: "check the input",
            trigger: "input#login",
            run() {
                assertEqual(document.querySelector("input#login").value, "");
                assertEqual(document.querySelector("input#password").value, "");
                document.querySelector(".oe_login_form .o_back_button").click();
            },
        },
        {
            content: "Remove the admin user from page",
            trigger: ".o_user_switch .d-flex:first-child .fa-times",
            run: "click",
        },
        {
            content: "only one user is left on quick login",
            trigger: ".o_user_switch",
            run() {
                const users = document.querySelectorAll(".o_user_avatar");
                assertEqual(users.length, 1);
                assertEqual(
                    users[0].parentElement.querySelector(".fs-5").innerText.trim(),
                    "Marc Demo"
                );
            },
        },
    ],
});
