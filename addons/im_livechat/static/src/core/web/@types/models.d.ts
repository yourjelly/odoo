declare module "models" {
    export interface Store {
        hasLivechatAccess: Boolean,
    }
    export interface DiscussApp {
        livechatThreads: Thread,
    }
    export interface Thread {
        anonymous_country: Object,
        anonymous_name: String,
        discussAppAsLivechat: DiscussApp,
    }

    export interface DiscussAppCategory {
        isLivechatCategory: Boolean,
        joinTitle: String,
        leaveTitle: String,
    }
}
