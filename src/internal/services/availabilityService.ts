import { ScheduleRepository } from '../repositories/scheduleRepository';
import { AppointmentRepository } from '../repositories/appointmentRepository';
import { PaginationParams, formatPaginatedResult, parseDateString } from '../shared/helpers';


const scheduleRepo = new ScheduleRepository();
const appointmentRepo = new AppointmentRepository();

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
    const startRange = parseDateString(startDateStr, false);
    const endRange = parseDateString(endDateStr, true);

    const now = new Date();
    const schedules = await scheduleRepo.findByTherapistIdForDateRange(therapistId, startRange, endRange);
    const activeAppointments = await appointmentRepo.findActiveAppointmentsInRange(
      therapistId,
      startRange,
      endRange
    );

    const availableSlots: AvailableSlot[] = [];
    const seenSlots = new Set<string>();

    const currDate = new Date(startRange);
    currDate.setHours(0, 0, 0, 0);

    while (currDate <= endRange) {
      const dayOfWeek = currDate.getDay();

      // Filter schedules effective on currDate
      const activeForDay = schedules.filter((s: any) => {
        if (s.dayOfWeek !== dayOfWeek) return false;
        const effFrom = new Date(s.effectiveFrom);
        effFrom.setHours(0, 0, 0, 0);
        if (effFrom > currDate) return false;
        if (s.effectiveUntil) {
          const effUntil = new Date(s.effectiveUntil);
          effUntil.setHours(23, 59, 59, 999);
          if (effUntil < currDate) return false;
        }
        return true;
      });

      for (const schedule of activeForDay) {
        if (!schedule.isActive) continue;

        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const [endH, endM] = schedule.endTime.split(':').map(Number);

        let slotStart = new Date(currDate.getFullYear(), currDate.getMonth(), currDate.getDate(), startH, startM, 0, 0);
        const shiftEnd = new Date(currDate.getFullYear(), currDate.getMonth(), currDate.getDate(), endH, endM, 0, 0);

        let breakStart: Date | null = null;
        let breakEnd: Date | null = null;

        if (schedule.breakStartTime && schedule.breakEndTime) {
          const [bStartH, bStartM] = schedule.breakStartTime.split(':').map(Number);
          const [bEndH, bEndM] = schedule.breakEndTime.split(':').map(Number);
          breakStart = new Date(currDate.getFullYear(), currDate.getMonth(), currDate.getDate(), bStartH, bStartM, 0, 0);
          breakEnd = new Date(currDate.getFullYear(), currDate.getMonth(), currDate.getDate(), bEndH, bEndM, 0, 0);
        }

        const slotDurMs = schedule.slotDuration * 60 * 1000;
        const bufferDurMs = (schedule.bufferDuration || 0) * 60 * 1000;

        while (slotStart.getTime() + slotDurMs <= shiftEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + slotDurMs);

          // Check if slot falls in future relative to current server time
          if (slotStart >= startRange && slotStart <= endRange && slotStart > now) {
            // Check if slot overlaps with break
            let overlapsBreak = false;
            if (breakStart && breakEnd) {
              if (slotStart < breakEnd && slotEnd > breakStart) {
                overlapsBreak = true;
              }
            }

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

          slotStart = new Date(slotStart.getTime() + slotDurMs + bufferDurMs);
        }
      }

      currDate.setDate(currDate.getDate() + 1);
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
