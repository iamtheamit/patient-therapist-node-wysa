import { ScheduleRepository } from '../repositories/scheduleRepository';
import { AppointmentRepository } from '../repositories/appointmentRepository';
import { AvailabilitySlotRepository } from '../repositories/availabilitySlotRepository';
import { PaginationParams, formatPaginatedResult } from '../shared/helpers/pagination';

const scheduleRepo = new ScheduleRepository();
const appointmentRepo = new AppointmentRepository();
const customSlotRepo = new AvailabilitySlotRepository();

export interface AvailableSlot {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export class AvailabilityService {
  public async getAvailableSlots(
    therapistId: string,
    startDateStr: string,
    endDateStr: string,
    paginationParams?: PaginationParams
  ): Promise<any> {
    let startRange: Date;
    let endRange: Date;

    if (startDateStr.length <= 10) {
      const [y, m, d] = startDateStr.split('-').map(Number);
      startRange = new Date(y, m - 1, d, 0, 0, 0, 0);
    } else {
      startRange = new Date(startDateStr);
    }

    if (endDateStr.length <= 10) {
      const [y, m, d] = endDateStr.split('-').map(Number);
      endRange = new Date(y, m - 1, d, 23, 59, 59, 999);
    } else {
      endRange = new Date(endDateStr);
    }

    const now = new Date();
    const schedules = await scheduleRepo.findByTherapistIdForDateRange(therapistId, startRange, endRange);
    const customSlots = await customSlotRepo.findByTherapistId(therapistId);
    const activeAppointments = await appointmentRepo.findActiveAppointmentsInRange(
      therapistId,
      startRange,
      endRange
    );

    const availableSlots: AvailableSlot[] = [];
    const seenSlots = new Set<string>();

    // 1. Process weekly shift schedules
    const currDate = new Date(startRange);
    currDate.setHours(0, 0, 0, 0);

    while (currDate <= endRange) {
      const dayOfWeek = currDate.getDay();
      
      // Filter schedules effective on currDate
      const activeForDay = schedules.filter((s: any) => {
        if (s.dayOfWeek !== dayOfWeek) return false;
        const effFrom = new Date(s.effectiveFrom || s.createdAt || new Date(0));
        effFrom.setHours(0, 0, 0, 0);
        if (effFrom > currDate) return false;
        if (s.effectiveUntil) {
          const effUntil = new Date(s.effectiveUntil);
          effUntil.setHours(23, 59, 59, 999);
          if (effUntil < currDate) return false;
        }
        return true;
      });

      // Deduplicate: if multiple rules exist for the day, pick the latest effective version
      const latestScheduleMap = new Map<number, any>();
      for (const sched of (activeForDay as any[])) {
        const existing = latestScheduleMap.get(sched.dayOfWeek);
        const schedEffFrom = new Date(sched.effectiveFrom || sched.createdAt || new Date(0));
        const existingEffFrom = existing ? new Date(existing.effectiveFrom || existing.createdAt || new Date(0)) : new Date(0);
        if (!existing || schedEffFrom > existingEffFrom) {
          latestScheduleMap.set(sched.dayOfWeek, sched);
        }
      }

      const daySchedules = Array.from(latestScheduleMap.values()).filter((s) => s.isActive);

      for (const schedule of daySchedules) {
        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const [endH, endM] = schedule.endTime.split(':').map(Number);

        const daySlotStart = new Date(currDate);
        daySlotStart.setHours(startH, startM, 0, 0);

        const daySlotEnd = new Date(currDate);
        daySlotEnd.setHours(endH, endM, 0, 0);

        // Break window for the day
        let breakStart: Date | null = null;
        let breakEnd: Date | null = null;
        if (schedule.breakStartTime && schedule.breakEndTime) {
          const [bStartH, bStartM] = schedule.breakStartTime.split(':').map(Number);
          const [bEndH, bEndM] = schedule.breakEndTime.split(':').map(Number);
          breakStart = new Date(currDate);
          breakStart.setHours(bStartH, bStartM, 0, 0);
          breakEnd = new Date(currDate);
          breakEnd.setHours(bEndH, bEndM, 0, 0);
        }

        const slotDurMs = schedule.slotDuration * 60 * 1000;
        const bufferDurMs = (schedule.bufferDuration ?? 10) * 60 * 1000;
        let slotStart = new Date(daySlotStart);

        while (slotStart.getTime() + slotDurMs <= daySlotEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + slotDurMs);

          if (slotStart > now) {
            // Check break overlap
            const overlapsBreak =
              breakStart && breakEnd && slotStart < breakEnd && slotEnd > breakStart;

            if (!overlapsBreak) {
              const isBookedOrHeld = activeAppointments.some((appt) => {
                const apptStart = new Date(appt.startTime);
                const apptEnd = new Date(appt.endTime);
                return apptStart < slotEnd && apptEnd > slotStart;
              });

              if (!isBookedOrHeld) {
                const key = slotStart.toISOString();
                if (!seenSlots.has(key)) {
                  seenSlots.add(key);
                  availableSlots.push({
                    startTime: slotStart.toISOString(),
                    endTime: slotEnd.toISOString(),
                    durationMinutes: schedule.slotDuration,
                  });
                }
              }
            }
          }

          // Advance by session length + inter-session buffer
          slotStart = new Date(slotStart.getTime() + slotDurMs + bufferDurMs);
        }
      }

      currDate.setDate(currDate.getDate() + 1);
    }

    // 2. Process custom availability slots created for specific dates (including recurring ones)
    for (const cSlot of customSlots) {
      const [year, month, day] = cSlot.date.split('-').map(Number);
      const [startH, startM] = cSlot.startTime.split(':').map(Number);
      const [endH, endM] = cSlot.endTime.split(':').map(Number);

      const origDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      const recEnd = cSlot.recurrenceEndDate
        ? (() => {
            const [ey, em, ed] = cSlot.recurrenceEndDate.split('-').map(Number);
            return new Date(ey, em - 1, ed, 23, 59, 59, 999);
          })()
        : null;

      let currDate = new Date(origDate);

      while (currDate <= endRange) {
        if (recEnd && currDate > recEnd) {
          break;
        }

        const slotStart = new Date(currDate.getFullYear(), currDate.getMonth(), currDate.getDate(), startH, startM, 0, 0);
        const slotEnd = new Date(currDate.getFullYear(), currDate.getMonth(), currDate.getDate(), endH, endM, 0, 0);

        if (slotStart >= startRange && slotStart <= endRange && slotStart > now) {
          const isBookedOrHeld = activeAppointments.some((appt) => {
            const apptStart = new Date(appt.startTime);
            const apptEnd = new Date(appt.endTime);
            return apptStart < slotEnd && apptEnd > slotStart;
          });

          if (!isBookedOrHeld) {
            const key = slotStart.toISOString();
            if (!seenSlots.has(key)) {
              seenSlots.add(key);
              const durationMins = Math.max(15, Math.round((slotEnd.getTime() - slotStart.getTime()) / 60000));
              availableSlots.push({
                startTime: slotStart.toISOString(),
                endTime: slotEnd.toISOString(),
                durationMinutes: durationMins,
              });
            }
          }
        }

        if (cSlot.isRecurring) {
          const repeat = cSlot.repeatType;
          const freq = cSlot.repeatFrequency;

          if (repeat === 'Daily') {
            currDate.setDate(currDate.getDate() + 1);
          } else if (repeat === 'Weekly') {
            let weeks = 1;
            if (freq === 'Every 2 weeks') weeks = 2;
            else if (freq === 'Every 3 weeks') weeks = 3;
            else if (freq === 'Every 4 weeks') weeks = 4;
            currDate.setDate(currDate.getDate() + 7 * weeks);
          } else if (repeat === 'Bi-Weekly') {
            currDate.setDate(currDate.getDate() + 14);
          } else if (repeat === 'Monthly') {
            currDate.setMonth(currDate.getMonth() + 1);
          } else {
            break;
          }
        } else {
          break;
        }
      }
    }

    // Sort chronologically
    availableSlots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const total = availableSlots.length;
    const { page, limit, skip } = paginationParams || {};

    let resultSlots = availableSlots;
    if (skip !== undefined && limit !== undefined) {
      resultSlots = availableSlots.slice(skip, skip + limit);
    }

    return formatPaginatedResult(resultSlots, total, page, limit);
  }
}
