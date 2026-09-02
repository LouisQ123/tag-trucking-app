// Shared by InvoiceEditor (the main ticket form) and ExtraTicketCard (the
// review cards for extra tickets found on the same scan) so both compute
// Total Hours identically. Travel time is added on top of the time-in/out
// span (it's billed time, not time to be excluded from it).
export function computeTotalHours(timeIn: string, timeOut: string, travel: string): number | null {
  if (!timeIn || !timeOut) return null;
  const [ih, im] = timeIn.split(":").map(Number);
  const [oh, om] = timeOut.split(":").map(Number);
  let diff = oh * 60 + om - (ih * 60 + im);
  if (diff < 0) diff += 24 * 60;
  const hours = Math.max(diff / 60 + (Number(travel) || 0), 0);
  return Math.round(hours * 100) / 100;
}
