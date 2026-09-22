import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { claimSpeechSession, releaseSpeechSession } from './speechSessionCoordinator';
import {
  collectSpeechRecognitionTranscript,
  getSpeechRecognitionConstructor,
  type BrowserSpeechRecognition,
  type BrowserSpeechRecognitionError,
} from './speechRecognitionTypes';
import type { SpeechLanguage } from './voiceInputCore';

export type SpeechRecognitionPhase =
  | 'idle'
  | 'waiting_permission'
  | 'listening'
  | 'ready';

export type SpeechRecognitionFailure =
  | 'generic'
  | 'no_speech'
  | 'permission_denied';

function subscribeToSpeechRecognitionSupport() {
  return () => {};
}

export function useSpeechRecognition() {
  const sessionIdRef = useRef(Symbol('speech-session'));
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const cancelledRef = useRef(false);
  const manualStopRef = useRef(false);
  const terminalFailureRef = useRef<SpeechRecognitionFailure | null>(null);
  const isSupported = useSyncExternalStore(
    subscribeToSpeechRecognitionSupport,
    () => Boolean(getSpeechRecognitionConstructor()),
    () => false,
  );
  const [phase, setPhase] = useState<SpeechRecognitionPhase>('idle');
  const [transcript, setTranscript] = useState('');
  const [failure, setFailure] = useState<SpeechRecognitionFailure | null>(null);
  const [interrupted, setInterrupted] = useState(false);

  const release = useCallback(() => {
    recognitionRef.current = null;
    releaseSpeechSession(sessionIdRef.current);
  }, []);

  const discardSession = useCallback((silent = false) => {
    cancelledRef.current = true;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try {
      recognition?.abort();
    } catch {
      // The browser may already have closed the recognition service.
    }
    releaseSpeechSession(sessionIdRef.current);
    transcriptRef.current = '';
    terminalFailureRef.current = null;
    setTranscript('');
    setInterrupted(false);
    setPhase('idle');
    if (!silent) setFailure(null);
  }, []);

  useEffect(() => {
    const sessionId = sessionIdRef.current;
    return () => {
      cancelledRef.current = true;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try {
        recognition?.abort();
      } catch {
        // The browser may already have closed the recognition service.
      }
      releaseSpeechSession(sessionId);
    };
  }, []);

  const start = useCallback((language: SpeechLanguage) => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      return false;
    }

    const recognition = new Recognition();
    cancelledRef.current = false;
    manualStopRef.current = false;
    terminalFailureRef.current = null;
    transcriptRef.current = '';
    setFailure(null);
    setInterrupted(false);
    setTranscript('');
    setPhase('waiting_permission');

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognitionRef.current = recognition;

    const failWithoutTranscript = (nextFailure: SpeechRecognitionFailure) => {
      terminalFailureRef.current = nextFailure;
      setFailure(nextFailure);
      setPhase('idle');
      setTranscript('');
      transcriptRef.current = '';
      release();
    };

    const isCurrentRecognition = () =>
      !cancelledRef.current && recognitionRef.current === recognition;

    recognition.onstart = () => {
      if (isCurrentRecognition()) setPhase('listening');
    };

    recognition.onresult = (event) => {
      if (!isCurrentRecognition()) return;
      const nextTranscript = collectSpeechRecognitionTranscript(event).transcript;
      transcriptRef.current = nextTranscript;
      setTranscript(nextTranscript);
    };

    recognition.onerror = (event) => {
      if (!isCurrentRecognition()) return;

      const error: BrowserSpeechRecognitionError = event.error;
      if (error === 'not-allowed' || error === 'service-not-allowed') {
        failWithoutTranscript('permission_denied');
        return;
      }

      if (transcriptRef.current.trim()) {
        terminalFailureRef.current = 'generic';
        setInterrupted(true);
        setPhase('ready');
        return;
      }

      failWithoutTranscript(error === 'no-speech' ? 'no_speech' : 'generic');
    };

    recognition.onend = () => {
      if (!isCurrentRecognition()) return;
      release();

      if (transcriptRef.current.trim()) {
        setInterrupted(!manualStopRef.current || terminalFailureRef.current !== null);
        setPhase('ready');
        return;
      }

      if (!terminalFailureRef.current) {
        setFailure('no_speech');
      }
      setPhase('idle');
    };

    claimSpeechSession(sessionIdRef.current, () => discardSession(true));

    try {
      recognition.start();
      return true;
    } catch {
      failWithoutTranscript('generic');
      return false;
    }
  }, [discardSession, release]);

  const stop = useCallback(() => {
    if (phase !== 'listening' && phase !== 'waiting_permission') return;
    manualStopRef.current = true;
    setInterrupted(false);
    setPhase('ready');
    try {
      recognitionRef.current?.stop();
    } catch {
      if (!transcriptRef.current.trim()) {
        terminalFailureRef.current = 'generic';
        setFailure('generic');
        setPhase('idle');
        release();
      }
    }
  }, [phase, release]);

  const complete = useCallback(() => {
    discardSession(true);
    setFailure(null);
  }, [discardSession]);

  return {
    cancel: () => discardSession(false),
    complete,
    failure,
    interrupted,
    isSupported,
    phase,
    start,
    stop,
    transcript,
  };
}
