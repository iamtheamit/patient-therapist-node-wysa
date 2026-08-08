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
    const schedules = await scheduleRepo.findByTherapistId(therapistId);
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
      const daySchedules = schedules.filter((s) => s.dayOfWeek === dayOfWeek);

      for (const schedule of daySchedules) {
        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const [endH, endM] = schedule.endTime.split(':').map(Number);

        const daySlotStart = new Date(currDate);
        daySlotStart.setHours(startH, startM, 0, 0);

        const daySlotEnd = new Date(currDate);
        daySlotEnd.setHours(endH, endM, 0, 0);

        let slotStart = new Date(daySlotStart);

        while (slotStart.getTime() + schedule.slotDuration * 60 * 1000 <= daySlotEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + schedule.slotDuration * 60 * 1000);

          if (slotStart > now) {
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

          slotStart = slotEnd;
        }
      }

      currDate.setDate(currDate.getDate() + 1);
    }

    // 2. Process custom availability slots created for specific dates
    for (const cSlot of customSlots) {
      const [year, month, day] = cSlot.date.split('-').map(Number);
      const [startH, startM] = cSlot.startTime.split(':').map(Number);
      const [endH, endM] = cSlot.endTime.split(':').map(Number);

      const slotStart = new Date(year, month - 1, day, startH, startM, 0, 0);
      const slotEnd = new Date(year, month - 1, day, endH, endM, 0, 0);

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
