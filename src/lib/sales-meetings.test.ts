import { describe, expect, it } from "vitest";
import { canRespondToMeeting, REQUIRED_MEETING_PEOPLE, responseForPerson, standaloneMeetingInput } from "./sales-meetings";
describe("sales meeting attendance", () => {
  it("creates an independent meeting with its content, date and required attendees without a deal", () => {
    const input = standaloneMeetingInput("متابعة أعمال الموقع", "2026-11-04T10:00:00.000Z", "المكتب", "مراجعة التقدم", []);
    expect(input.deal_id).toBeNull();
    expect(input.topic).toBe("متابعة أعمال الموقع");
    expect(input.meeting_at).toBe("2026-11-04T10:00:00.000Z");
    expect(input.attendees).toEqual(["ceo@metalfuze.local", "haitham@metalfuze.local", "eilaf@metalfuze.local"]);
  });
  it("allows creating meetings without any accompanying person", () => {
    expect(standaloneMeetingInput("اجتماع", "2026-11-04T10:00:00Z", "", "", []).companions).toEqual([]);
  });
  it("always includes Eilaf for meeting updates without making her an approver", () => {
    expect(standaloneMeetingInput("اجتماع", "2026-11-04T10:00:00Z", "", "", []).attendees).toContain("eilaf@metalfuze.local");
    expect(canRespondToMeeting("eilaf@metalfuze.local", true, ["eilaf@metalfuze.local"])).toBe(false);
  });
  const attendees: [string, string] = ["ceo@metalfuze.local", "haitham@metalfuze.local"];
  it("routes approvals to CEO and Haitham", () => {
    expect(REQUIRED_MEETING_PEOPLE.map((p) => p.email)).toEqual(attendees);
  });
  it("keeps CEO acceptance independent of Haitham rejection", () => {
    const responses = [
      { attendee_email: attendees[0], response: "accepted", note: "", responded_at: "2026-11-01" },
      { attendee_email: attendees[1], response: "declined", note: "", responded_at: "2026-11-01" },
    ];
    expect(responseForPerson(responses, attendees[0])).toBe("accepted");
    expect(responseForPerson(responses, attendees[1])).toBe("declined");
    expect(responseForPerson([], attendees[1])).toBe("pending");
  });
  it("allows only confirmed invited CEO and Haitham to respond", () => {
    for (const email of attendees) expect(canRespondToMeeting(email, true, attendees)).toBe(true);
    expect(canRespondToMeeting(attendees[0], false, attendees)).toBe(false);
    expect(canRespondToMeeting(attendees[0], true, [])).toBe(false);
    expect(canRespondToMeeting("eilaf@metalfuze.local", true, [...attendees, "eilaf@metalfuze.local"])).toBe(false);
    expect(canRespondToMeeting("hisham@metalfuze.local", true, [...attendees, "hisham@metalfuze.local"])).toBe(false);
  });
});