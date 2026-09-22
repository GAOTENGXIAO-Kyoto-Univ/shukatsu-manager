import {
  ArrowUp,
  Check,
  ChevronDown,
  Mic,
  Square,
  X,
} from '@tamagui/lucide-icons-2';
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ElementRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Button, GetProps, Text, TextArea, XStack, YStack } from 'tamagui';

import { getCurrentAppLocale } from '@/i18n';
import { AppButton } from '@/components/ui/AppButton';
import { useSpeechRecognition } from './useSpeechRecognition';
import {
  getReliableVoiceSelection,
  getStoredSpeechLanguage,
  mergeVoiceTranscript,
  resolveInitialSpeechLanguage,
  setStoredSpeechLanguage,
  SPEECH_LANGUAGES,
  subscribeToSpeechLanguage,
  type SpeechLanguage,
  type VoiceSelection,
} from './voiceInputCore';

type TextAreaProps = GetProps<typeof TextArea>;

type VoiceTextAreaProps = Omit<
  TextAreaProps,
  'editable' | 'onChangeText' | 'value'
> & {
  onChangeText: (value: string) => void;
  onVoiceActiveChange?: (active: boolean) => void;
  onVoiceConfirmSelection?: (selection: VoiceSelection) => void;
  value: string;
};

export const VoiceTextArea = forwardRef<
  ElementRef<typeof TextArea>,
  VoiceTextAreaProps
>(function VoiceTextArea(
  {
    onChangeText,
    onSelectionChange,
    onVoiceActiveChange,
    onVoiceConfirmSelection,
    selection,
    style,
    value,
    ...textAreaProps
  },
  forwardedRef,
) {
  const { t } = useTranslation('voice');
  const speech = useSpeechRecognition();
  const [language, setLanguage] = useState<SpeechLanguage>(() =>
    resolveInitialSpeechLanguage(getStoredSpeechLanguage(), getCurrentAppLocale()),
  );
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [localFailure, setLocalFailure] = useState<'unavailable' | null>(null);
  const [sessionLanguage, setSessionLanguage] = useState<SpeechLanguage>(language);
  const baseValueRef = useRef(value);
  const selectionRef = useRef<{
    selection: VoiceSelection;
    value: string;
  } | null>(null);
  const sessionSelectionRef = useRef<VoiceSelection | null>(null);

  const active = speech.phase !== 'idle';
  const previewValue = active
    ? mergeVoiceTranscript({
        baseValue: baseValueRef.current,
        selection: sessionSelectionRef.current,
        transcript: speech.transcript,
      })
    : value;

  useEffect(() => subscribeToSpeechLanguage(setLanguage), []);

  useEffect(() => {
    onVoiceActiveChange?.(active);
    return () => onVoiceActiveChange?.(false);
  }, [active, onVoiceActiveChange]);

  function chooseLanguage(nextLanguage: SpeechLanguage) {
    setLanguage(nextLanguage);
    setStoredSpeechLanguage(nextLanguage);
    setLanguageMenuOpen(false);
    setLocalFailure(null);
  }

  function startVoiceInput() {
    setLanguageMenuOpen(false);
    setLocalFailure(null);

    if (speech.isSupported === false) {
      setLocalFailure('unavailable');
      return;
    }

    const latestStoredLanguage = getStoredSpeechLanguage();
    const nextLanguage = latestStoredLanguage ?? language;
    const normalizedControlledSelection = selection
      ? { start: selection.start, end: selection.end ?? selection.start }
      : null;
    const controlledSelection = normalizedControlledSelection
      ? getReliableVoiceSelection(normalizedControlledSelection, value.length)
      : null;
    const observedSelection =
      selectionRef.current?.value === value
        ? getReliableVoiceSelection(selectionRef.current.selection, value.length)
        : null;

    baseValueRef.current = value;
    sessionSelectionRef.current = selection
      ? controlledSelection
      : observedSelection;
    setSessionLanguage(nextLanguage);
    setStoredSpeechLanguage(nextLanguage);
    speech.start(nextLanguage);
  }

  function confirmVoiceInput() {
    const normalizedTranscript = speech.transcript.trim();
    const mergedValue = mergeVoiceTranscript({
      baseValue: baseValueRef.current,
      selection: sessionSelectionRef.current,
      transcript: speech.transcript,
    });
    speech.complete();
    if (mergedValue !== baseValueRef.current) {
      onChangeText(mergedValue);
      const cursor = sessionSelectionRef.current
        ? sessionSelectionRef.current.start + normalizedTranscript.length
        : mergedValue.length;
      onVoiceConfirmSelection?.({ start: cursor, end: cursor });
    }
  }

  const failure = localFailure ?? speech.failure;
  const failureMessage = failure
    ? t(
        failure === 'unavailable'
          ? 'errors.unavailable'
          : failure === 'permission_denied'
            ? 'errors.permissionDenied'
            : failure === 'no_speech'
              ? 'errors.noSpeech'
              : 'errors.recognitionFailed',
      )
    : null;
  const statusLabel =
    speech.phase === 'waiting_permission'
      ? t('status.waitingPermission')
      : speech.phase === 'listening'
        ? t('status.listening')
        : speech.interrupted
          ? t('status.interrupted')
          : t('status.ready');

  return (
    <YStack gap="$xs">
      <YStack position="relative">
        <TextArea
          {...textAreaProps}
          ref={forwardedRef}
          pb={68}
          readOnly={active}
          selection={selection}
          value={previewValue}
          onChangeText={onChangeText}
          onSelectionChange={(event) => {
            selectionRef.current = {
              selection: {
                start: event.nativeEvent.selection.start,
                end:
                  event.nativeEvent.selection.end ??
                  event.nativeEvent.selection.start,
              },
              value,
            };
            onSelectionChange?.(event);
          }}
          style={{
            borderRadius: 12,
            ...(typeof style === 'object' && !Array.isArray(style) ? style : {}),
          }}
        />

        {active ? (
          <XStack
            bg="$surfaceMuted"
            borderColor="$border"
            borderWidth={1}
            gap="$xs"
            minH={48}
            px="$xs"
            style={{
              alignItems: 'center',
              borderRadius: 12,
              bottom: 8,
              left: 8,
              position: 'absolute',
              right: 8,
            }}
          >
            <AppButton
              aria-label={t('actions.cancel')}
              icon={<X size={18} />}
              onPress={speech.cancel}
              p={0}
              minH={44}
              variant="ghost"
              width={44}
            />
            <Text color="$textSecondary" fontSize={13} fontWeight="600">
              {t(`languages.${sessionLanguage}`)}
            </Text>
            <XStack flex={1} gap="$xs" style={{ alignItems: 'center', minWidth: 0 }}>
              <YStack
                bg={speech.phase === 'ready' ? '$successStrong' : '$danger'}
                height={7}
                width={7}
                style={{ borderRadius: 9999 }}
              />
              <Text color="$textSecondary" flex={1} fontSize={12} numberOfLines={1}>
                {statusLabel}
              </Text>
            </XStack>
            {speech.phase === 'ready' ? (
              <AppButton
                aria-label={t('actions.confirm')}
                disabled={!speech.transcript.trim()}
                icon={<ArrowUp size={18} />}
                onPress={confirmVoiceInput}
                p={0}
                minH={44}
                variant="primary"
                width={44}
              />
            ) : (
              <AppButton
                aria-label={t('actions.stop')}
                icon={<Square size={15} fill="currentColor" />}
                onPress={speech.stop}
                p={0}
                minH={44}
                variant="secondary"
                width={44}
              />
            )}
          </XStack>
        ) : (
          <>
            {languageMenuOpen ? (
              <YStack
                bg="$surface"
                borderColor="$border"
                borderWidth={1}
                p="$xs"
                style={{
                  borderRadius: 12,
                  bottom: 56,
                  position: 'absolute',
                  right: 52,
                  zIndex: 20,
                }}
              >
                {SPEECH_LANGUAGES.map((option) => (
                  <Button
                    aria-label={t(`languages.${option}`)}
                    bg={option === language ? '$accentSoft' : 'transparent'}
                    borderWidth={0}
                    color="$text"
                    iconAfter={option === language ? <Check size={15} /> : undefined}
                    key={option}
                    minH={44}
                    onPress={() => chooseLanguage(option)}
                    px="$sm"
                    style={{ justifyContent: 'space-between' }}
                  >
                    {t(`languages.${option}`)}
                  </Button>
                ))}
              </YStack>
            ) : null}
            <XStack
              gap="$xs"
              style={{
                alignItems: 'center',
                bottom: 8,
                position: 'absolute',
                right: 8,
              }}
            >
              <AppButton
                aria-label={t('actions.chooseLanguage')}
                iconAfter={<ChevronDown size={15} />}
                onPress={() => {
                  setLanguageMenuOpen((open) => !open);
                  setLocalFailure(null);
                }}
                minH={44}
                px="$sm"
                variant="ghost"
              >
                {t(`languages.${language}`)}
              </AppButton>
              <AppButton
                aria-label={t('actions.start')}
                icon={<Mic size={18} />}
                onPress={startVoiceInput}
                opacity={speech.isSupported === false ? 0.45 : 1}
                p={0}
                minH={44}
                variant="ghost"
                width={44}
              />
            </XStack>
          </>
        )}
      </YStack>
      {failureMessage ? (
        <Text color="$danger" fontSize={13} lineHeight={19}>
          {failureMessage}
        </Text>
      ) : null}
    </YStack>
  );
});
