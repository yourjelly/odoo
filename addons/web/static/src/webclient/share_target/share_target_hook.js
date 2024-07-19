import { useService } from "@web/core/utils/hooks";
import { onMounted } from "@odoo/owl";

export function useShareTarget(selectedAppKey, onShareTargetFile) {
    const shareTarget = useService("share_target");
    onMounted(() => {
        if (shareTarget.selectedApp() === selectedAppKey && shareTarget.hasSharedFiles()) {
            const files = shareTarget.getSharedFilesToUpload();
            shareTarget.cleanup();
            onShareTargetFile(files);
        }
    });
}
