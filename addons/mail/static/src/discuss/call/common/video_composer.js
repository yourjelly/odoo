export class VideoComposer {
    canvas = document.createElement("canvas");
    audioContext;
    audioDestination;
    stream;
    mainVideoTrack;
    secondaryVideoTrack;
    audioTracks = new Map();

    constructor() {
        this.stream = this.canvas.captureStream(30);
        this.audioContext = new AudioContext();
        this.audioDestination = this.audioContext.createMediaStreamDestination();
        const baseSource = this.audioContext.createBufferSource();
        baseSource.connect(this.audioDestination);
        this.stream.addTrack(this.audioDestination.stream.getAudioTracks()[0]);
    }

    async start() {
        // start clock (for video? or just move audio destination creation here).
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

    addAudioTrack(track) {
        // TODO handle unique (track id?), track existing,...
        const source = this.audioContext.createMediaStreamSource(new MediaStream([track]));
        source.connect(this.audioDestination);
    }
    removeAudioTrack() {}
    setMainVideoTrack() {}
    setSecondaryVideoTrack() {}
}
