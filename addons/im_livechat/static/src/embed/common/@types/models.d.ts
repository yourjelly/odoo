declare module "models" {
    import { ChatbotStep as ChatbotStepClass } from "@im_livechat/embed/common/chatbot/chatbot_step_model";

    export interface ChatbotStep extends ChatbotStepClass {}

    export interface Message {
        chatbotStep: ChatbotStep,
    }

    export interface Thread {
        chatbotTypingMessage: Message,
        livechatWelcomeMessage: Message,
        chatbot_script_id: number | null,
        requested_by_operator: boolean,
        isNewlyCreated: boolean,
    }

    export interface Models {
        "ChatbotStep": ChatbotStep,
    }
}
