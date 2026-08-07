import { ScheduleRepository } from '../repositories/scheduleRepository';
import { ScheduleItemDto } from '../validators/scheduleValidator';

const scheduleRepo = new ScheduleRepository();

export class ScheduleService {
  public async getTherapistSchedule(therapistId: string) {
    return scheduleRepo.findByTherapistId(therapistId);
  }

  public async updateTherapistSchedule(therapistId: string, items: ScheduleItemDto[]) {
    return scheduleRepo.updateSchedules(therapistId, items);
  }
}
