import { ScheduleRepository } from '../repositories/scheduleRepository';
import { AppointmentRepository } from '../repositories/appointmentRepository';

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
    endDateStr: string
  ): Promise<AvailableSlot[]> {
    const startRange = new Date(startDateStr);
    const endRange = new Date(endDateStr);

    // Set endRange to end of day if only date is passed
    if (endDateStr.length <= 10) {
      endRange.setHours(23, 59, 59, 999);
    }

    const now = new Date();
    const schedules = await scheduleRepo.findByTherapistId(therapistId);
    if (schedules.length === 0) {
      return [];
    }

    const activeAppointments = await appointmentRepo.findActiveAppointmentsInRange(
      therapistId,
      startRange,
      endRange
    );

    const availableSlots: AvailableSlot[] = [];

    // Loop through each day from startRange to endRange
    const currDate = new Date(startRange);
    currDate.setHours(0, 0, 0, 0);

    while (currDate <= endRange) {
      const dayOfWeek = currDate.getDay(); // 0 = Sunday, ..., 6 = Saturday
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

          // Skip past slots
          if (slotStart > now) {
            // Check for overlap with active appointments
            const isBookedOrHeld = activeAppointments.some((appt) => {
              const apptStart = new Date(appt.startTime);
              const apptEnd = new Date(appt.endTime);
              return apptStart < slotEnd && apptEnd > slotStart;
            });

            if (!isBookedOrHeld) {
              availableSlots.push({
                startTime: slotStart.toISOString(),
                endTime: slotEnd.toISOString(),
                durationMinutes: schedule.slotDuration,
              });
            }
          }

          // Advance to next slot
          slotStart = slotEnd;
        }
      }

      // Increment day
      currDate.setDate(currDate.getDate() + 1);
    }

    return availableSlots;
  }
}
