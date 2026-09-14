import { Building2, FilePenLine, Trash2 } from '@tamagui/lucide-icons-2';
import type { ReactNode } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { useTranslation } from 'react-i18next';

import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import type { ApplicationDetailData } from './types';

type ApplicationDetailActionMenuProps = {
  application: ApplicationDetailData | null;
  onClose: () => void;
  onEditApplication: () => void;
  onEditCompany: () => void;
  onRequestDelete: () => void;
  open: boolean;
};

export function ApplicationDetailActionMenu({
  application,
  onClose,
  onEditApplication,
  onEditCompany,
  onRequestDelete,
  open,
}: ApplicationDetailActionMenuProps) {
  const { t } = useTranslation('companies');
  return (
    <ResponsiveOverlay
      open={open && Boolean(application)}
      onClose={onClose}
      title={t('detail.actions')}
      desktopPresentation="popover"
      width={320}
    >
      {application ? (
        <YStack gap="$base">
          <YStack gap="$xs">
            <Text color="$text" fontWeight="600">
              {application.company.name}
            </Text>
            <Text color="$textSecondary">{application.jobTitle}</Text>
          </YStack>

          <MenuAction
            icon={<FilePenLine color="$textSecondary" size={18} />}
            label={t('form.editApplication')}
            onPress={onEditApplication}
          />
          <MenuAction
            icon={<Building2 color="$textSecondary" size={18} />}
            label={t('form.editCompany')}
            onPress={onEditCompany}
          />
          <MenuAction
            danger
            icon={<Trash2 color="$danger" size={18} />}
            label={t('deleteDialog.action')}
            onPress={onRequestDelete}
          />
        </YStack>
      ) : null}
    </ResponsiveOverlay>
  );
}

function MenuAction({
  danger = false,
  icon,
  label,
  onPress,
}: {
  danger?: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <XStack
      bg={danger ? '$dangerSoft' : '$surfaceMuted'}
      cursor="pointer"
      gap="$sm"
      onPress={onPress}
      p="$md"
      style={{ alignItems: 'center', borderRadius: 12, minHeight: 44 }}
    >
      {icon}
      <Text color={danger ? '$danger' : '$text'} fontWeight="600">
        {label}
      </Text>
    </XStack>
  );
}
