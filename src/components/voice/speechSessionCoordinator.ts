type ActiveSpeechSession = {
  cancel: () => void;
  id: symbol;
};

let activeSession: ActiveSpeechSession | null = null;

export function claimSpeechSession(id: symbol, cancel: () => void) {
  if (activeSession?.id !== id) {
    activeSession?.cancel();
  }

  activeSession = { cancel, id };
}

export function releaseSpeechSession(id: symbol) {
  if (activeSession?.id === id) {
    activeSession = null;
  }
}

