/* @odoo-module */

import { Message } from "@mail/core_ui/message";
import { MessageConfirmDialog } from "@mail/core_ui/message_confirm_dialog";
import { useMessagePinService } from "@mail/discuss/message_pin/message_pin_service";
import { Component, onWillStart, onWillUpdateProps, useState, useSubEnv } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";

export class PinnedMessagesPanel extends Component {
    static components = {
        Message,
    };
    static props = ["thread"];
    static template = "discuss.PinnedMessagesPanel";

    setup() {
        this.threadService = useService("mail.thread");
        this.messageService = useService("mail.message");
        this.store = useService("mail.store");
        this.rpc = useService("rpc");
        this.ui = useState(useService("ui"));
        this.messagePinService = useMessagePinService();
        onWillStart(() => {
            this.messagePinService.fetchPinnedMessages(this.props.thread);
        });
        onWillUpdateProps(async (nextProps) => {
            if (nextProps.thread.id !== this.props.thread.id) {
                this.messagePinService.fetchPinnedMessages(nextProps.thread);
            }
        });
        useSubEnv({
            pinnedPanel: true,
        });
    }

    /**
     * Highlight the given message and scrolls to it. In small mode, the
     * pin menu is closed beforwards
     *
     * @param {Message} message
     */
    async onClickJump(message) {
        if (this.ui.isSmall) {
            this.env.pinMenu.close();
            // Give the time to the pin menu to close before scrolling
            // to the message.
            await new Promise((resolve) => setTimeout(() => requestAnimationFrame(resolve)));
        }
        await this.env.messageHighlight?.highlightMessage(message.id, this.props.thread);
    }

    /**
     * Prompt the user for confirmation and unpin the given message if
     * confirmed.
     *
     * @param {Message} message
     */
    onClickUnpin(message) {
        this.env.services.dialog.add(MessageConfirmDialog, {
            message,
            messageComponent: Message,
            prompt: _t("Are you sure you want to remove this pinned message?"),
            onConfirm: () => this.messagePinService.setPin(message, false),
        });
    }

    /**
     * Get the message to display when nothing is pinned on this thread.
     */
    get emptyMessage() {
        if (this.props.thread.type === "channel") {
            return _t("This channel doesn't have any pinned messages.");
        } else {
            return _t("This conversation doesn't have any pinned messages.");
        }
    }
}
