import { Building2, FilePenLine, Trash2 } from '@tamagui/lucide-icons-2';
import type { ReactNode } from 'react';
import { Text, XStack, YStack } from 'tamagui';

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
  return (
    <ResponsiveOverlay
      open={open && Boolean(application)}
      onClose={onClose}
      title="操作"
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
            label="编辑应聘信息"
            onPress={onEditApplication}
          />
          <MenuAction
            icon={<Building2 color="$textSecondary" size={18} />}
            label="编辑企业信息"
            onPress={onEditCompany}
          />
          <MenuAction
            danger
            icon={<Trash2 color="$danger" size={18} />}
            label="删除应聘记录"
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
