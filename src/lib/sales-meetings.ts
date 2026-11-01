export const REQUIRED_MEETING_PEOPLE = [
  { email: "hisham@metalfuze.local", name: "هشام" },
  { email: "haitham@metalfuze.local", name: "هيثم" },
];
export type MeetingResponse = { attendee_email: string; response: string; note: string; responded_at: string };
export function canRespondToMeeting(email: string | undefined, confirmed: boolean, attendees: string[]) {
  const value = email?.toLowerCase();
  return confirmed && !!value && REQUIRED_MEETING_PEOPLE.some((p) => p.email === value) && attendees.some((e) => e.toLowerCase() === value);
}
export function responseForPerson(responses: MeetingResponse[], email: string) {
  return responses.find((r) => r.attendee_email.toLowerCase() === email.toLowerCase())?.response ?? "pending";
}