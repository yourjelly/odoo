import { Component, tags, useState } from "@odoo/owl";
import { Notification as NotificationComponent } from "../components/Notification/Notification";

interface NotificationAPI {
  displayNotification: (text: string) => void;
}

interface Notification {
  id: Number;
  title?: string;
  message: string;
}

let notifications: Notification[];
export class NotificationManager extends Component {
  static template = tags.xml`
        <div class="o_notification_manager">
            <t t-foreach="notifications" t-as="notif" t-key="notif.id">
                <NotificationComponent t-props="notif"/>
            </t>
        </div>`;
  static components = { NotificationComponent };
  notifications = useState([]);

  // FIXME
  constructor() {
    super(...arguments);
    notifications = this.notifications;
  }
}

let notifId: number = 0;
export const notificationService = {
  name: "notifications",
  deploy(): NotificationAPI {
    return {
      displayNotification(text: string): void {
        const notif: Notification = {
          id: ++notifId,
          message: text,
        };
        console.log("notification " + text);
        notifications.push(notif);
        console.log(notifications);
      },
    };
  },
};
