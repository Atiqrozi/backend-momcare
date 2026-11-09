const DAYS_TO_ESTIMATED_DUE_DATE = 280;

export function calculateEstimatedDueDate(lmpDate: string): Date {
  const date = new Date(`${lmpDate.slice(0, 10)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + DAYS_TO_ESTIMATED_DUE_DATE);
  return date;
}
