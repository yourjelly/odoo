/** @odoo-module **/

import { registry } from "@web/core/registry";
import { assert, makeSeed, triggerHotkey } from "./utils";

let seed;
const steps = [
    /** Inbox */
    {
        content: "Inbox (1)",
        trigger: "button:contains(Inbox)",
    },
    {
        content: "Inbox (2)",
        trigger: "body",
        run() {
            seed = makeSeed();
            assert.once(".o-mail-Discuss");
            assert.once(".o-mail-DiscussSidebar");
            assert.once(".o-mail-DiscussSidebar button:contains(Start a meeting)");
            assert.once(".o-mail-DiscussSidebar button:contains(Inbox)");
            assert.once(".o-mail-DiscussSidebar button:contains(Inbox) .fa-inbox");
            assert.once(".o-mail-DiscussSidebar button:contains(Inbox).o-active");
            assert.once(".o-mail-DiscussSidebar button:contains(Starred)");
            assert.once(".o-mail-DiscussSidebar button:contains(Starred):not(.o-active)");
            assert.once(".o-mail-DiscussSidebar button:contains(History)");
            assert.once(".o-mail-DiscussCategory:contains(Channels)");
            assert.once("i[title='View or join channels']");
            assert.once("i[title='Add or join a channel']");
            assert.once(".o-mail-DiscussCategory:contains(Direct messages)");
            assert.once("i[title='Start a conversation']");
            assert.once(".o-mail-Discuss-header");
            assert.once(".o-mail-Discuss-header input[title=Inbox]");
            assert.once(".o-mail-Discuss-header button:contains(Mark all read)");
            assert.once(".o-mail-Discuss-header button:contains(Mark all read)[disabled]");
            assert.none(".o-mail-Discuss-header button[title='Add Users']");
            assert.once(".o-mail-Thread");
            assert.once(".o-mail-Thread:contains(Congratulations, your inbox is empty)");
            assert.once(".o-mail-Thread:contains(New messages appear here.)");
            assert.none(".o-mail-Thread .o-mail-Message");
            assert.none(".o-mail-Composer");
        },
    },
    /** Starred */
    {
        content: "Starred (1)",
        trigger: "button:contains(Starred)",
    },
    {
        content: "Starred (2)",
        trigger: "body",
        run() {
            assert.once(".o-mail-Discuss");
            assert.once(".o-mail-DiscussSidebar button:contains(Starred).o-active");
            assert.once(".o-mail-DiscussSidebar button:contains(Inbox):not(.o-active)");
            assert.once(".o-mail-Discuss-header input[title=Starred]");
            assert.once(".o-mail-Discuss-header button:contains(Unstar all)");
            assert.once(".o-mail-Discuss-header button:contains(Unstar all)[disabled]");
            assert.once(".o-mail-Thread");
            assert.once(".o-mail-Thread:contains(No starred messages)");
            assert.once(
                ".o-mail-Thread:contains(You can mark any message as 'starred', and it shows up in this mailbox)"
            );
            assert.none(".o-mail-Thread .o-mail-Message");
            assert.none(".o-mail-Composer");
        },
    },
    /** Channel */
    {
        content: "Channel (1)",
        trigger: "body",
        run() {
            assert.none(`.o-mail-DiscussCategoryItem:contains(channel.${seed})`);
        },
    },
    {
        content: "Channel (2)",
        trigger: "i[title='Add or join a channel']",
    },
    {
        content: "Channel (3)",
        trigger: "body",
        run() {
            assert.once(".o-mail-ChannelSelector");
            assert.once(".o-mail-ChannelSelector input[placeholder='Add or join a channel']");
        },
    },
    {
        content: "Channel (4)",
        trigger: ".o-mail-ChannelSelector input",
        run(actions) {
            actions.text(`channel.${seed}`);
        },
    },
    {
        content: "Channel (5)",
        trigger: "body",
        run() {
            assert.once(`.o-mail-ChannelSelector-suggestion:contains(channel.${seed})`);
        },
    },
    {
        content: "Channel (6)",
        trigger: ".o-mail-ChannelSelector-suggestion",
    },
    {
        content: "Channel (7)",
        trigger: "body",
        run() {
            assert.once(
                `.o-mail-DiscussCategory:contains(Channels) ~ .o-mail-DiscussCategoryItem:contains(channel.${seed})`
            );
            assert.once(`.o-mail-DiscussCategoryItem:contains(channel.${seed}).o-active`);
            assert.once(
                `.o-mail-DiscussCategoryItem:contains(channel.${seed}) img[alt='Thread Image']`
            );
            assert.once(
                `.o-mail-DiscussCategoryItem:contains(channel.${seed}) [title='Channel settings']`
            );
            assert.once(
                `.o-mail-DiscussCategoryItem:contains(channel.${seed}) [title='Leave this channel']`
            );
            assert.once(`.o-mail-Discuss-header input[title='channel.${seed}']`);
            assert.once(".o-mail-Discuss-header input[placeholder='Add a description']");
            assert.once(".o-mail-Discuss-header button[title='Pinned messages']");
            assert.once(".o-mail-Discuss-header button[title='Start a Call']");
            assert.once(".o-mail-Discuss-header button[title='Add Users']");
            assert.once(".o-mail-Discuss-header button[title='Show Member List']");
            assert.once(".o-mail-Discuss-header button[title='Show Call Settings']");
            assert.once(".o-mail-Thread");
            assert.none(".o-mail-Thread .o-mail-Message");
            assert.once("hr + span:contains(Today) + hr");
            assert.once(`.o-mail-Thread:contains(Mitchell Admin created #channel.${seed})`);
            assert.once(".o-mail-Composer");
            assert.once(".o-mail-Composer img[alt='Avatar of user']");
            assert.once(
                ".o-mail-Composer img[alt='Avatar of user'][src*='/mail/channel/'][src*='/partner/'][src*='/avatar_128']"
            );
            assert.once(".o-mail-Composer-input");
            assert.once(`.o-mail-Composer-input[placeholder='Message #channel.${seed}…']`);
            assert.once(".o-mail-Composer button[aria-label='Emojis']");
            assert.once(".o-mail-Composer button[title='Attach files']");
            assert.once(".o-mail-Composer button:contains(Send)");
            assert.equal(document.activeElement, $(".o-mail-Composer-input")[0]);
        },
    },
    /** Post message */
    {
        content: "Post messag - simple (1)",
        trigger: ".o-mail-Composer-input",
        run: "text cheese",
    },
    {
        content: "Post message - simple (2)",
        trigger: ".o-mail-Composer-send",
    },
    {
        content: "Post message - simple (3)",
        trigger: "body",
        run() {
            assert.once(".o-mail-Message");
            assert.once(
                ".o-mail-Message-sidebar img[src*='/mail/channel/'][src*='/partner/'][src*='/avatar_128']"
            );
            assert.once(".o-mail-Message-header:contains(Mitchell Admin)");
            assert.once(".o-mail-Message-header:contains(now)");
            assert.once(".o-mail-Message-content:contains(cheese)");
            assert.n(".o-mail-Message .o-mail-Message-actions i", 4);
            assert.once(".o-mail-Message [title='Add a Reaction']");
            assert.once(".o-mail-Message [title='Reply']");
            assert.once(".o-mail-Message [title='Mark as Todo']");
            assert.once(".o-mail-Message [title='Expand']");
            assert.equal($(".o-mail-Composer input").val(), "");
            assert.equal(document.activeElement, $(".o-mail-Composer-input")[0]);
        },
    },
    {
        content: "Message channel - expand options (1)",
        trigger: ".o-mail-Message [title='Expand']",
    },
    {
        content: "Message channel - expand options (2)",
        trigger: "body",
        run() {
            assert.n(".o-mail-Message .o-mail-Message-actions i", 8);
            assert.once(".o-mail-Message [title='Pin']");
            assert.once(".o-mail-Message [title='Mark as Unread']");
            assert.once(".o-mail-Message [title='Edit']");
            assert.once(".o-mail-Message [title='Delete']");
        },
    },
    {
        content: "Post message - emoji substitution (1)",
        trigger: ".o-mail-Composer-input",
        run: "text test :P :laughing:",
    },
    {
        content: "Post message - emoji substitution (2)",
        trigger: ".o-mail-Composer-input",
        async run() {
            triggerHotkey("Enter");
        },
    },
    {
        content: "Post message - emoji substitution (3)",
        trigger: "body",
        run() {
            assert.once(".o-mail-Message:contains(test 😛 😆)");
            assert.none(".o-mail-Message:contains(test 😛 😆) .o-mail-Message-header"); // message is squashed
            assert.none(
                ".o-mail-Message:contains(test 😛 😆) img[src*='/mail/channel/'][src*='/partner/'][src*='/avatar_128']"
            ); // message is squashed
        },
    },
    {
        content: "Post message - linkify (1)",
        trigger: ".o-mail-Composer-input",
        run: "text test https://www.odoo.com/",
    },
    {
        content: "Post message - linkify (2)",
        trigger: ".o-mail-Composer-input",
        async run() {
            triggerHotkey("Enter");
        },
    },
    {
        content: "Post message - linkify (3)",
        trigger: "body",
        run() {
            assert.once(".o-mail-Message a[href='https://www.odoo.com/']");
            // TODO link preview shown after a small delay, make assertions
        },
    },
];

registry.category("web_tour.tours").add("discuss_tour", {
    url: "/web#action=mail.action_discuss",
    test: true,
    steps,
});
