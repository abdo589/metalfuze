export const REQUIRED_MEETING_PEOPLE = [
  { email: "ceo@metalfuze.local", name: "CEO" },
  { email: "haitham@metalfuze.local", name: "هيثم" },
];
export type MeetingResponse = { attendee_email: string; response: string; note: string; responded_at: string };
export function standaloneMeetingInput(topic: string, meetingAt: string, place: string, notes: string, attendees: string[]) {
  return { deal_id: null, topic: topic.trim(), meeting_at: meetingAt, place, notes, companions: attendees, attendees: [...new Set([...attendees, ...REQUIRED_MEETING_PEOPLE.map((p) => p.email), "eilaf@metalfuze.local"])] };
}
export function canRespondToMeeting(email: string | undefined, confirmed: boolean, attendees: string[]) {
  const value = email?.toLowerCase();
  return confirmed && !!value && REQUIRED_MEETING_PEOPLE.some((p) => p.email === value) && attendees.some((e) => e.toLowerCase() === value);
}
export function responseForPerson(responses: MeetingResponse[], email: string) {
  return responses.find((r) => r.attendee_email.toLowerCase() === email.toLowerCase())?.response ?? "pending";
}