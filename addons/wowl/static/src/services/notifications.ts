import { Component, tags } from "@odoo/owl";
import type { OdooEnv } from "../env";
import { Notification as NotificationComponent } from "../components/notification/notification";

const AUTOCLOSE_DELAY: number = 4000;

interface NotificationService {
  closeNotification: (id: number) => void;
  displayNotification: (text: string, sticky: boolean) => number;
}

interface Notification {
  id: number;
  message: string;
  title?: string;
}

export class NotificationManager extends Component<{}, OdooEnv> {
  static template = tags.xml`
    <div class="o_notification_manager">
        <t t-foreach="notifications" t-as="notif" t-key="notif.id">
            <NotificationComponent t-props="notif"/>
        </t>
    </div>`;
  static components = { NotificationComponent };
  notifications: Notification[] = [];

  constructor() {
    super(...arguments);
    this.env.bus.on("NOTIFICATIONS_CHANGE", this, (notifications) => {
      this.notifications = notifications;
      this.render();
    });
  }
}

export const notificationService = {
  name: "notifications",
  deploy(env: OdooEnv): NotificationService {
    let notifId: number = 0;
    let notifications: Notification[] = [];

    function closeNotification(id: number): void {
      const index = notifications.findIndex((n) => n.id === id);
      notifications.splice(index, 1);
      env.bus.trigger("NOTIFICATIONS_CHANGE", notifications);
    }

    function displayNotification(text: string, sticky: boolean): number {
      const notif: Notification = {
        id: ++notifId,
        message: text,
      };
      notifications.push(notif);
      env.bus.trigger("NOTIFICATIONS_CHANGE", notifications);
      if (!sticky) {
        setTimeout(() => closeNotification(notif.id), AUTOCLOSE_DELAY);
      }
      return notif.id;
    }

    return { closeNotification, displayNotification };
  },
};
