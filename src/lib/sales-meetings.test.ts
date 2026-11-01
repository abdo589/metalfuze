import { describe, expect, it } from "vitest";
import { canRespondToMeeting, REQUIRED_MEETING_PEOPLE, responseForPerson } from "./sales-meetings";
describe("sales meeting attendance", () => {
  const attendees = ["hisham@metalfuze.local", "haitham@metalfuze.local"];
  it("routes meetings to Hisham and Haitham", () => {
    expect(REQUIRED_MEETING_PEOPLE.map((p) => p.email)).toEqual(attendees);
  });
  it("keeps Hisham acceptance independent of Haitham rejection", () => {
    const responses = [
      { attendee_email: attendees[0], response: "accepted", note: "", responded_at: "2026-11-01" },
      { attendee_email: attendees[1], response: "declined", note: "", responded_at: "2026-11-01" },
    ];
    expect(responseForPerson(responses, attendees[0])).toBe("accepted");
    expect(responseForPerson(responses, attendees[1])).toBe("declined");
    expect(responseForPerson([], attendees[1])).toBe("pending");
  });
  it("allows only confirmed invited Hisham and Haitham to respond", () => {
    for (const email of attendees) expect(canRespondToMeeting(email, true, attendees)).toBe(true);
    expect(canRespondToMeeting(attendees[0], false, attendees)).toBe(false);
    expect(canRespondToMeeting(attendees[0], true, [])).toBe(false);
    expect(canRespondToMeeting("eilaf@metalfuze.local", true, [...attendees, "eilaf@metalfuze.local"])).toBe(false);
  });
});