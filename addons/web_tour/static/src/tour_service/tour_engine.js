import { validate } from "@odoo/owl";

export class TourEngine {
    constructor(steps) {
        validate(
            { steps },
            {
                steps: {
                    type: Array,
                    element: {
                        type: Object,
                        shape: {
                            action: { type: Function },
                            trigger: { type: Function, optional: true },
                        },
                    },
                },
            }
        );
        this.steps = steps;
        this.currentIndex = 0;
        this.isComplete = false;
        this.whenCompleted = new Promise((resolve, reject) => {
            this.completed = resolve;
        });
        this.advance();
    }

    async checkTrigger(trigger) {
        let el;
        if (!trigger) {
            return [true, el];
        }
        el = await trigger();
        if (el) {
            return [true, el];
        } else {
            return [false, el];
        }
    }

    async advance() {
        if (this.isComplete) {
            this.completed();
            return;
        }
        const step = this.steps[this.currentIndex];
        const [proceedToAction, el] = await this.checkTrigger(step.trigger);
        if (proceedToAction) {
            const actionResult = await step.action(el);
            if (!actionResult) {
                this.currentIndex++;
                if (this.currentIndex === this.steps.length) {
                    this.isComplete = true;
                }
                await this.advance();
            }
        }
    }
}
