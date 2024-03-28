import { VideoComposer } from "./video_composer.js";

// should use a record
export class callRecordStage {
    speakerStack = []; // stack of rtc session records
    videoComposer = new VideoComposer();
}
