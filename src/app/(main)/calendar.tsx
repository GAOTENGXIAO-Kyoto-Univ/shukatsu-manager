import { ChevronLeft, ChevronRight, Plus } from '@tamagui/lucide-icons-2';
import { useQuery_experimental as useQuery } from 'convex/react';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { Spinner, Text, XStack, YStack, useMedia } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import { warmPaperColors } from '../../../tamagui.config';
import { CalendarEventOverlay } from '@/components/calendar/CalendarEventOverlay';
import {
  buildMonthCells,
  firstDateOfMonth,
  formatMonthTitle,
  formatSelectedDate,
  japanDateKey,
  monthFromDate,
  monthRange,
  normalizeDate,
  normalizeMonth,
  shiftMonth,
} from '@/components/calendar/calendarDate';
import type {
  CalendarEvent,
  IndependentCalendarEvent,
} from '@/components/calendar/types';
import { formatEventDate } from '@/components/events/eventFormatting';
import { AppButton } from '@/components/ui/AppButton';
import { useRetainedQueryData } from '@/hooks/useRetainedQueryData';

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

function readRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function sortEvents(left: CalendarEvent, right: CalendarEvent) {
  if (left.hasExplicitTime !== right.hasExplicitTime) {
    return left.hasExplicitTime ? -1 : 1;
  }
  return left.datetime - right.datetime || left.createdAt - right.createdAt;
}

function eventTitle(event: CalendarEvent) {
  const suffix = event.timingType === 'deadline' ? ' 截止' : '';
  return event.kind === 'independent'
    ? `${event.title}${suffix}`
    : `${event.companyName} · ${event.selectionStepName}${suffix}`;
}

function cellEventTitle(event: CalendarEvent) {
  const suffix = event.timingType === 'deadline' ? ' 截止' : '';
  return event.kind === 'independent'
    ? `${event.title}${suffix}`
    : `${event.companyName} ${event.selectionStepName}${suffix}`;
}

export default function CalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const media = useMedia();
  const today = japanDateKey();
  const todayMonth = monthFromDate(today);
  const rawMonth = readRouteParam(params.month);
  const rawDate = readRouteParam(params.date);
  const month = normalizeMonth(rawMonth, todayMonth);
  const dateFallback = month === todayMonth ? today : firstDateOfMonth(month);
  const selectedDate = normalizeDate(rawDate, month, dateFallback);
  const range = useMemo(() => monthRange(month), [month]);
  const [retryToken, setRetryToken] = useState(0);
  const eventState = useQuery({
    query: api.events.listForCalendar,
    args: { ...range, retryToken },
  });
  const retainedEvents = useRetainedQueryData(eventState, month);
  const events: CalendarEvent[] = useMemo(
    () => (retainedEvents.hasData ? retainedEvents.data : []),
    [retainedEvents],
  );
  const cells = useMemo(() => buildMonthCells(month), [month]);
  const [addOpen, setAddOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<IndependentCalendarEvent | null>(null);
  const isDesktop = Boolean(media.md);

  useEffect(() => {
    if (rawMonth !== month || rawDate !== selectedDate) {
      router.replace({
        pathname: '/calendar',
        params: { month, date: selectedDate },
      } as Href);
    }
  }, [month, rawDate, rawMonth, router, selectedDate]);

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = japanDateKey(event.datetime);
      const current = grouped.get(key) ?? [];
      current.push(event);
      grouped.set(key, current);
    }
    for (const current of grouped.values()) current.sort(sortEvents);
    return grouped;
  }, [events]);
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];

  function navigate(nextMonth: string, nextDate: string) {
    router.replace({
      pathname: '/calendar',
      params: { month: nextMonth, date: nextDate },
    } as Href);
  }

  function changeMonth(amount: number) {
    const nextMonth = shiftMonth(month, amount);
    const nextDate = nextMonth === todayMonth ? today : firstDateOfMonth(nextMonth);
    navigate(nextMonth, nextDate);
  }

  function selectDate(nextDate: string) {
    router.setParams({
      month: monthFromDate(nextDate),
      date: nextDate,
    });
  }

  function openEvent(event: CalendarEvent) {
    if (event.kind === 'independent') {
      setEditingEvent(event);
      return;
    }
    router.push(
      `/applications/${event.applicationId}?step=${event.selectionStepId}` as Href,
    );
  }

  return (
    <YStack flex={1} bg="$background">
      <ScrollView style={{ flex: 1 }}>
        <YStack
          gap="$xl"
          maxW={1180}
          p={isDesktop ? '$xl' : '$base'}
          pb="$xxl"
          width="100%"
          style={{ alignSelf: 'center' }}
        >
          <XStack gap="$base" style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <YStack gap="$xs">
              <Text color="$textMuted" fontSize={13} fontWeight="600" letterSpacing={1}>
                CALENDAR
              </Text>
              <Text color="$text" fontSize={isDesktop ? 34 : 29} fontWeight="600" lineHeight={42}>
                日历
              </Text>
              <Text color="$textSecondary">选考安排与个人日程集中在同一个月视图。</Text>
            </YStack>
            <AppButton
              icon={<Plus size={18} />}
              variant="primary"
              onPress={() => setAddOpen(true)}
            >
              添加
            </AppButton>
          </XStack>

          <YStack
            bg="$surface"
            borderColor="$border"
            borderWidth={1}
            gap="$base"
            p={isDesktop ? '$lg' : '$sm'}
            style={{ borderRadius: 16 }}
          >
            <XStack gap="$sm" px="$xs" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <AppButton
                aria-label="上个月"
                icon={<ChevronLeft size={18} />}
                variant="ghost"
                onPress={() => changeMonth(-1)}
              />
              <YStack style={{ alignItems: 'center' }}>
                <Text color="$text" fontSize={21} fontWeight="600">
                  {formatMonthTitle(month)}
                </Text>
                {month !== todayMonth ? (
                  <Text
                    color="$textMuted"
                    cursor="pointer"
                    fontSize={12}
                    onPress={() => navigate(todayMonth, today)}
                  >
                    回到今天
                  </Text>
                ) : null}
              </YStack>
              <AppButton
                aria-label="下个月"
                icon={<ChevronRight size={18} />}
                variant="ghost"
                onPress={() => changeMonth(1)}
              />
            </XStack>

            <XStack>
              {weekdays.map((weekday) => (
                <YStack key={weekday} py="$xs" style={{ alignItems: 'center', width: '14.2857%' }}>
                  <Text color="$textMuted" fontSize={12} fontWeight="600">{weekday}</Text>
                </YStack>
              ))}
            </XStack>

            <XStack borderLeftColor="$border" borderLeftWidth={1} borderTopColor="$border" borderTopWidth={1} flexWrap="wrap">
              {cells.map((cell) => {
                const dayEvents = cell.inCurrentMonth ? eventsByDate.get(cell.date) ?? [] : [];
                const selected = cell.date === selectedDate;
                const isToday = cell.date === today;

                return (
                  <YStack
                    key={cell.date}
                    bg={selected ? '$accentSoft' : '$surface'}
                    borderBottomColor="$border"
                    borderBottomWidth={1}
                    borderRightColor="$border"
                    borderRightWidth={1}
                    cursor="pointer"
                    minH={isDesktop ? 112 : 68}
                    onPress={() => selectDate(cell.date)}
                    p={isDesktop ? '$sm' : '$xs'}
                    style={{ width: '14.2857%' }}
                  >
                    <YStack
                      bg={isToday ? '$accentStrong' : 'transparent'}
                      height={isDesktop ? 27 : 23}
                      width={isDesktop ? 27 : 23}
                      style={{ alignItems: 'center', borderRadius: 999, justifyContent: 'center' }}
                    >
                      <Text
                        color={isToday ? '$surface' : cell.inCurrentMonth ? '$text' : '$textMuted'}
                        fontSize={isDesktop ? 13 : 12}
                        fontWeight={selected || isToday ? '700' : '500'}
                      >
                        {cell.day}
                      </Text>
                    </YStack>
                    {cell.inCurrentMonth ? (
                      <YStack gap={2} mt="$xs">
                        {dayEvents.slice(0, 2).map((event) => (
                          <Text
                            key={event.eventId}
                            color={event.kind === 'selection' ? '$infoStrong' : '$accentStrong'}
                            fontSize={isDesktop ? 11 : 9}
                            fontWeight="600"
                            numberOfLines={1}
                          >
                            {event.hasExplicitTime
                              ? `${formatEventDate(event).split(' ').at(-1)} `
                              : ''}
                            {cellEventTitle(event)}
                          </Text>
                        ))}
                        {dayEvents.length > 2 ? (
                          <Text color="$textMuted" fontSize={isDesktop ? 11 : 9}>
                            +{dayEvents.length - 2}
                          </Text>
                        ) : null}
                      </YStack>
                    ) : null}
                  </YStack>
                );
              })}
            </XStack>
            {eventState.status === 'pending' && !retainedEvents.hasData ? (
              <XStack gap="$sm" py="$sm" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Spinner color="$accentStrong" size="small" />
                <Text color="$textMuted" fontSize={13}>正在读取本月日程...</Text>
              </XStack>
            ) : null}
            {eventState.status === 'error' && !retainedEvents.hasData ? (
              <XStack gap="$sm" py="$sm" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Text color="$danger">本月日程读取失败，请稍后重试</Text>
                <AppButton variant="secondary" onPress={() => setRetryToken((value) => value + 1)}>重试</AppButton>
              </XStack>
            ) : eventState.status === 'success' && events.length === 0 ? (
              <XStack gap="$sm" py="$sm" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Text color="$textMuted">本月暂无日程</Text>
                <AppButton variant="ghost" onPress={() => setAddOpen(true)}>添加日程</AppButton>
              </XStack>
            ) : null}
          </YStack>

          <YStack gap="$base">
            <XStack gap="$base" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <YStack gap="$xs">
                <Text color="$text" fontSize={22} fontWeight="600">
                  {formatSelectedDate(selectedDate)}
                </Text>
                <Text color="$textMuted" fontSize={13}>
                  {eventState.status === 'pending' && !retainedEvents.hasData
                    ? '读取中...'
                    : selectedEvents.length > 0
                      ? `${selectedEvents.length} 项日程`
                      : '暂无日程'}
                </Text>
              </YStack>
              <AppButton variant="secondary" onPress={() => setAddOpen(true)}>添加日程</AppButton>
            </XStack>

            {eventState.status === 'pending' && !retainedEvents.hasData ? (
              <YStack borderColor="$border" borderWidth={1} gap="$sm" p="$xl" style={{ alignItems: 'center', borderRadius: 16 }}>
                <Spinner color="$accentStrong" />
                <Text color="$textSecondary">正在读取当天日程...</Text>
              </YStack>
            ) : eventState.status === 'error' && !retainedEvents.hasData ? (
              <YStack borderColor="$border" borderWidth={1} gap="$sm" p="$xl" style={{ alignItems: 'center', borderRadius: 16 }}>
                <Text color="$danger">当天日程读取失败，请稍后重试</Text>
                <AppButton variant="secondary" onPress={() => setRetryToken((value) => value + 1)}>重试</AppButton>
              </YStack>
            ) : selectedEvents.length > 0 ? (
              <YStack borderTopColor="$border" borderTopWidth={1}>
                {selectedEvents.map((event) => (
                  <YStack
                    key={event.eventId}
                    borderBottomColor="$border"
                    borderBottomWidth={1}
                    cursor="pointer"
                    gap="$sm"
                    onPress={() => openEvent(event)}
                    py="$base"
                    px="$xs"
                    hoverStyle={{ background: warmPaperColors.surfaceMuted }}
                  >
                    <XStack gap="$base" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <YStack flex={1} gap="$xs">
                        <Text color="$text" fontSize={17} fontWeight="600">
                          {eventTitle(event)}
                        </Text>
                        {event.kind === 'selection' ? (
                          <Text color="$textSecondary" fontSize={13}>
                            {event.jobTitle}
                          </Text>
                        ) : (
                          <Text color="$textMuted" fontSize={13}>独立日程</Text>
                        )}
                        {event.location ? (
                          <Text color="$textSecondary" fontSize={13}>{event.location}</Text>
                        ) : null}
                        {event.note ? (
                          <Text color="$textMuted" fontSize={13} numberOfLines={2}>{event.note}</Text>
                        ) : null}
                      </YStack>
                      <YStack gap="$xs" style={{ alignItems: 'flex-end' }}>
                        {event.hasExplicitTime ? (
                          <Text color="$text" fontSize={13} fontWeight="600">
                            {formatEventDate(event).split(' ').at(-1)}
                          </Text>
                        ) : null}
                        <Text color={event.kind === 'selection' ? '$infoStrong' : '$accentStrong'} fontSize={12}>
                          {event.kind === 'selection' ? '选考' : '个人'}
                        </Text>
                      </YStack>
                    </XStack>
                  </YStack>
                ))}
              </YStack>
            ) : (
              <YStack
                borderColor="$border"
                borderWidth={1}
                gap="$sm"
                p="$xl"
                style={{ alignItems: 'center', borderRadius: 16 }}
              >
                <Text color="$text" fontSize={17} fontWeight="600">当天暂无日程</Text>
                <Text color="$textSecondary" style={{ textAlign: 'center' }}>
                  可以添加个人安排，或为尚未设置时间的选考步骤安排日程。
                </Text>
              </YStack>
            )}
          </YStack>
        </YStack>
      </ScrollView>

      {addOpen ? (
        <CalendarEventOverlay
          key={`add-${selectedDate}`}
          date={selectedDate}
          event={null}
          onClose={() => setAddOpen(false)}
          open
        />
      ) : null}
      {editingEvent ? (
        <CalendarEventOverlay
          key={editingEvent.eventId}
          date={selectedDate}
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          open
        />
      ) : null}
    </YStack>
  );
}
