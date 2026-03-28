import { useCallback, useRef, useState } from "react";

const SILENCE_THRESHOLD = 10;
const SILENCE_DURATION = 1500;

export function useVoiceInput(onResult: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number>(0);

  const stopRecording = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    cancelAnimationFrame(animFrameRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    setStream(mediaStream);

    // Silence detection
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(mediaStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkSilence = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (const v of dataArray) {
        sum += v;
      }
      const avg = sum / dataArray.length;

      if (avg < SILENCE_THRESHOLD) {
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            stopRecording();
            source.disconnect();
            audioCtx.close();
          }, SILENCE_DURATION);
        }
      } else if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      animFrameRef.current = requestAnimationFrame(checkSilence);
    };
    checkSilence();

    const mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: "audio/webm",
    });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      for (const track of mediaStream.getTracks()) {
        track.stop();
      }
      setStream(null);

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("file", blob, "recording.webm");

      try {
        const res = await fetch("/api/transcribe", {
          body: formData,
          method: "POST",
        });
        const data = await res.json();
        if (data.text) {
          onResult(data.text);
        }
      } catch {
        // silently fail — user can type instead
      }
    };

    mediaRecorder.start();
    setRecording(true);
  }, [onResult]);

  const toggle = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      start();
    }
  }, [recording, start, stopRecording]);

  return { recording, stream, toggle };
}
