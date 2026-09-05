import { ReactNode, useEffect, useRef } from 'react';
import { Portal, XStack, YStack, Text, useMedia } from 'tamagui';

import { warmPaperColors } from '../../../tamagui.config';
import { AppButton } from '@/components/ui/AppButton';

type DesktopPresentation = 'modal' | 'popover';

type ResponsiveOverlayProps = {
  children: ReactNode;
  desktopPresentation?: DesktopPresentation;
  dismissOnEscape?: boolean;
  mobileNearFullscreen?: boolean;
  onClose: () => void;
  open: boolean;
  title: string;
  width?: number;
  headerAction?: ReactNode;
  headerLeading?: ReactNode;
};

export function ResponsiveOverlay({
  children,
  desktopPresentation = 'modal',
  dismissOnEscape = true,
  mobileNearFullscreen = false,
  onClose,
  open,
  title,
  width = 440,
  headerAction,
  headerLeading,
}: ResponsiveOverlayProps) {
  const media = useMedia();
  const isDesktop = Boolean(media.md);
  const isPopover = isDesktop && desktopPresentation === 'popover';
  const canDismissRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    canDismissRef.current = false;

    const handle = window.setTimeout(() => {
      canDismissRef.current = true;
    }, 80);

    function handleKeyDown(event: KeyboardEvent) {
      if (dismissOnEscape && event.key === 'Escape') {
        onCloseRef.current();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(handle);
      window.removeEventListener('keydown', handleKeyDown);
      canDismissRef.current = false;
    };
  }, [dismissOnEscape, open]);

  if (!open) {
    return null;
  }

  return (
    <Portal open zIndex={900}>
      <YStack
        style={{
          alignItems: isPopover ? 'flex-end' : 'center',
          bottom: 0,
          justifyContent: isPopover ? 'flex-start' : isDesktop ? 'center' : 'flex-end',
          left: 0,
          position: 'fixed',
          right: 0,
          top: 0,
          zIndex: 900,
        }}
      >
        <YStack
          aria-label="关闭"
          onPress={() => {
            if (canDismissRef.current) {
              onClose();
            }
          }}
          bg="$overlayBackdrop"
          style={{
            bottom: 0,
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
            zIndex: 0,
          }}
        />
        <YStack
          width={isDesktop ? width : '100%'}
          bg="$surface"
          mt={isPopover ? 84 : 0}
          mr={isPopover ? '$lg' : 0}
          p="$lg"
          gap="$base"
          shadowColor="$text"
          shadowOpacity={0.08}
          shadowRadius={18}
          style={{
            borderColor: warmPaperColors.border,
            borderRadius: isDesktop || !mobileNearFullscreen ? 16 : 12,
            borderWidth: 1,
            boxSizing: 'border-box',
            height: mobileNearFullscreen ? (isDesktop ? '86%' : '96%') : undefined,
            maxHeight: isDesktop ? '86%' : mobileNearFullscreen ? '96%' : '88%',
            overflow: mobileNearFullscreen ? 'hidden' : undefined,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <XStack gap="$base" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <XStack gap="$sm" style={{ alignItems: 'center' }}>
              {headerLeading}
              <Text color="$text" fontSize={20} fontWeight="600">
                {title}
              </Text>
            </XStack>
            {headerAction === undefined ? (
              <AppButton variant="ghost" onPress={onClose}>
                取消
              </AppButton>
            ) : (
              headerAction
            )}
          </XStack>
          {children}
        </YStack>
      </YStack>
    </Portal>
  );
}
