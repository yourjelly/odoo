import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add("discuss_channel_kept_after_reload", {
    test: true,
    steps: () => [
        { trigger: ".o-mail-DiscussSidebar-item:contains(Inbox).o-active" },
        { trigger: ".o-mail-DiscussSidebar-item:contains(Sales)" },
        {
            trigger: ".o-mail-DiscussSidebar-item:contains(Sales).o-active",
            run: () => location.reload(),
        },
        { trigger: ".o-mail-DiscussSidebar-item:contains(Sales).o-active" },
    ],
});
