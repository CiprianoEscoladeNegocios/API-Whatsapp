declare module 'mic-recorder-to-mp3' {
  interface MicRecorderConfig {
    bitRate?: number;
    sampleRate?: number;
  }

  class MicRecorder {
    constructor(config?: MicRecorderConfig);
    start(): Promise<void>;
    stop(): {
      getMp3(): Promise<[any[], Blob]>;
    };
  }

  export default MicRecorder;
}
