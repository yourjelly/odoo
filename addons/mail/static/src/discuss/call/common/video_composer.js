import { browser } from "@web/core/browser/browser";

export class VideoComposer {
    canvas = document.createElement("canvas");
    audioNode;
    stream;
    mainVideoTrack;
    secondaryVideoTrack;
    audioTracks = new Map();

    constructor() {
        this.stream = this.canvas.captureStream(30);
        this.stream.addTrack(this.audioNode);
    }

    async start() {
        // start clock
    }
    stop() {
        // stop clock
    }

    drawImage() {
        // draw video on canvas
        // if main video & secondary = draw both on canvas, find a way to position them
        // else draw either on full screen
        // draw name of person on top of video
    }

    pause() {}

    addAudioTrack() {}
    removeAudioTrack() {}
    setMainVideoTrack() {}
    setSecondaryVideoTrack() {}
}
