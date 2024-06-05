import { registry } from "@web/core/registry";

const requestChatSteps = [
    {
        trigger: ".o-livechat-LivechatButton",
        run: "click",
    },
    {
        trigger: ".o-mail-ChatWindow",
        isCheck: true,
    },
];

registry.category("web_tour.tours").add("im_livechat_request_chat", {
    test: true,
    steps: () => requestChatSteps,
    shadow_dom: ".o-livechat-root",
});

registry.category("web_tour.tours").add("im_livechat_request_chat_and_send_message", {
    test: true,
    shadow_dom: ".o-livechat-root",
    steps: () => [
        ...requestChatSteps,
        {
            trigger: ".o-mail-Composer-input",
            run: "fill Hello, I need help please !",
        },
        {
            trigger: ".o-mail-Composer-input",
            run: "press Enter",
        },
        {
            trigger: ".o-mail-Message:contains('Hello, I need help')",
            isCheck: true,
        },
    ],
});
