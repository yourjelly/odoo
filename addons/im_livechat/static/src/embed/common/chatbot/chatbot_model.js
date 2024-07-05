import { AND, Record } from "@mail/core/common/record";
import { rpc } from "@web/core/network/rpc";
import { browser } from "@web/core/browser/browser";
import { debounce } from "@web/core/utils/timing";

export class Chatbot extends Record {
    static id = AND("script", "thread");
    static MESSAGE_DELAY = 1500;
    // Time to wait without user input before considering a multi line step as
    // completed.
    static MULTILINE_STEP_DEBOUNCE_DELAY = 10000;

    isTyping = false;
    script = Record.one("ChatbotScript");
    currentStep = Record.one("ChatbotStep");
    steps = Record.many("ChatbotStep");
    thread = Record.one("Thread", { inverse: "chatbot" });
    typingMessage = Record.one("Message", {
        compute() {
            if (this.isTyping && this.thread) {
                return {
                    id: -0.1 - this.thread.id,
                    thread: this.thread,
                    author: this.script.partner,
                };
            }
        },
    });
    /**
     * @type {(message: import("models").Message) => Promise<void>}
     */
    _processAnswerDebounced = Record.attr(null, {
        compute() {
            return debounce(
                this._processAnswer,
                this.script.isLivechatTourRunning ? 500 : Chatbot.MULTILINE_STEP_DEBOUNCE_DELAY
            );
        },
    });

    /**
     * @param {import("models").Message} message
     */
    async processAnswer(message) {
        if (this.thread.notEq(message.thread) || !this.currentStep?.expectAnswer) {
            return;
        }
        if (this.currentStep.type === "free_input_multi") {
            await this._processAnswerDebounced(message);
        }
        await this._processAnswer(message);
    }

    async triggerNextStep() {
        console.log("\n\n fonction triggerNextStep")
        if (this.currentStep) {
            await this._simulateTyping();
        }
        console.log("(début)  this.currentStep", this.currentStep)
        await this._goToNextStep();
        if (!this.currentStep || this.currentStep.completed || !this.thread) {
            return;
        }
        console.log("(milieu)  this.currentStep", this.currentStep)
        const { Message: messages = [] } = this.store.insert(this.currentStep.data, { html: true });
        this.currentStep.message =
            messages[0] ??
            this.store.Message.insert(
                {
                    id: this.store.getNextTemporaryId(),
                    author: this.script.partner,
                    body: this.currentStep.scriptStep.message,
                    thread: this.thread,
                },
                { html: true }
            );
        this.thread.messages.add(this.currentStep.message);
        console.log("\n\n\n\nEn théorie celui là fonctionne bien : \n\n\n\n")
        console.log("(fin) this.currentStep", this.currentStep)
        console.log("this.currentStep?.scriptStep?.id", this.currentStep?.scriptStep?.id)
    }

    get completed() {
        return (
            (this.currentStep?.isLast &&
                (!this.currentStep.expectAnswer || this.currentStep?.completed)) ||
            this.currentStep?.operatorFound
        );
    }

    /**
     * Go to the next step of the chatbot, fetch it if needed.
     */
    async _goToNextStep() {
        if (!this.thread || this.currentStep?.isLast) {
            return;
        }
        if (this.steps.at(-1)?.eq(this.currentStep)) {
            const nextStep = await rpc("/chatbot/step/trigger", {
                channel_id: this.thread.id,
                chatbot_script_id: this.script.id,
            });
            if (!nextStep) {
                this.currentStep.isLast = true;
                return;
            }
            this.steps.push(nextStep);
        }
        const nextStepIndex = this.steps.lastIndexOf(this.currentStep) + 1;
        this.currentStep = this.steps[nextStepIndex];
    }

    /**
     * Simulate the typing of the chatbot.
     */
    async _simulateTyping() {
        this.isTyping = true;
        await new Promise((res) =>
            setTimeout(() => {
                this.isTyping = false;
                res();
            }, Chatbot.MESSAGE_DELAY)
        );
    }

    async _processAnswer(message) {
        let stepCompleted = true;
        if (this.currentStep.type === "question_email") {
            stepCompleted = await this._processAnswerQuestionEmail();
        } else if (this.currentStep.type === "question_selection") {
            stepCompleted = await this._processAnswerQuestionSelection(message);
        }
        this.currentStep.completed = stepCompleted;
    }

    /**
     * Process the user answer for a question selection step.
     *
     * @param {import("models").Message} message Answer posted by the user.
     * @returns {Promise<boolean>} Whether the script is ready to go to the next step.
     */
    async _processAnswerQuestionSelection(message) {
        if (this.currentStep.selectedAnswer) {
            return true;
        }
        const answer = this.currentStep.answers.find(({ label }) => message.body.includes(label));
        
        if (answer == undefined){
            console.log("\n\n\n\n\n\n\n BUG DETECTE : answer == undefined")
            console.log("D'après mes observations, je crois que message.body est à jour mais que currentStep est en retard d'une question")
            console.log("En effet, currentStep est passé à la bonne étape après le click sur la réponse précédente, puis est revenu")
            console.log("à la question d'avant en soum soum avant d'arriver à la réponse actuelle")

            console.log("affichage des données utiles :")
            console.log("this.currentStep", this.currentStep)
            console.log("this.currentStep.answers.forEach((x) => console.log(x));")
            this.currentStep.answers.forEach((x) => console.log(x)); // x correspond à label

            console.log("\n\n\n\n12345678 J'appelle le debugger :")
            debugger
        }
        if (this.currentStep.message == undefined){
            console.log("\n\n\n\n\n\n\nBUG DETECTE : this.currentStep.message == undefined")
            
            console.log("affichage des données utiles :")
            console.log('answer', answer)
            console.log("this.currentStep", this.currentStep)
            console.log("this.currentStep?.message", this.currentStep?.message)
            console.log("this.currentStep.answers.forEach((x) => console.log(x));")
            this.currentStep.answers.forEach((x) => console.log(x)); // x correspond à label

            console.log("\n\n\n\n12345678 J'appelle le debugger :")
            debugger
        }

        this.currentStep.selectedAnswer = answer;
        await rpc("/chatbot/answer/save", {
            channel_id: this.thread.id,
            message_id: this.currentStep.message.id,
            selected_answer_id: answer.id,
        });
        console.log("En cas de bug, ce label n'apparaîtra jamais")
        if (!answer.redirectLink) {
            return true;
        }
        let isRedirecting = false;
        if (answer.redirectLink && URL.canParse(answer.redirectLink, window.location.href)) {
            const url = new URL(window.location.href);
            const nextURL = new URL(answer.redirectLink, window.location.href);
            isRedirecting = url.pathname !== nextURL.pathname || url.origin !== nextURL.origin;
        }
        const targetURL = new URL(answer.redirectLink, window.location.origin);
        const redirectionAlreadyDone = targetURL.href === location.href;
        if (!redirectionAlreadyDone) {
            browser.location.assign(answer.redirectLink);
        }
        return redirectionAlreadyDone || !isRedirecting;
    }

    /**
     * Process the user answer for a question email step.
     *
     * @returns {Promise<boolean>} Whether the script is ready to go to the next step.
     */
    async _processAnswerQuestionEmail() {
        const { success, data } = await rpc("/chatbot/step/validate_email", {
            channel_id: this.thread.id,
        });
        const { Message: messages = [] } = this.store.insert(data, { html: true });
        const [message] = messages;
        if (message) {
            this.thread.messages.add(message);
        }
        return success;
    }

    /**
     * Restart the chatbot script.
     */
    restart() {
        if (this.currentStep) {
            this.currentStep.isLast = false;
        }
    }
}
Chatbot.register();
