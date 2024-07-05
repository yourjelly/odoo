import { useService } from "@web/core/utils/hooks";
import { BarcodeVideoScanner } from "@web/webclient/barcode/barcode_scanner";

export class CameraBarcodeScanner extends BarcodeVideoScanner {
    static props = [];
    setup() {
        super.setup();
        this.barcodeScanner = useService("barcode_reader");
        this.sound = useService("sound");
        this.props = {
            facingMode: "environment",
            onResult: (result) => this.barcodeScanner.scan(result),
            onError: console.error,
            close: () => {},
        };
    }
    onResult(result) {
        super.onResult(result);
        this.sound.play("beep");
        clearInterval(this.interval);
        setTimeout(() => {
            if (this.videoPreviewRef.el) {
                this.interval = setInterval(this.detectCode.bind(this), 100);
            }
        }, 2000);
    }
}
