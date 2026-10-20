export const CRITERIA = [
  { key: "quality", ar: "جودة العمل ودقته", max: 25 },
  { key: "attendance", ar: "الالتزام بالحضور والمواعيد", max: 15 },
  { key: "productivity", ar: "الإنتاجية وإنجاز المهام", max: 20 },
  { key: "teamwork", ar: "التعاون والعمل الجماعي", max: 15 },
  { key: "initiative", ar: "المبادرة وتحمل المسؤولية", max: 15 },
  { key: "policies", ar: "الالتزام بالسياسات والتعليمات", max: 10 },
] as const;

export const QUARTERS = [
  { q: 1, ar: "الربع الأول", months: "يناير – مارس" },
  { q: 2, ar: "الربع الثاني", months: "أبريل – يونيو" },
  { q: 3, ar: "الربع الثالث", months: "يوليو – سبتمبر" },
  { q: 4, ar: "الربع الرابع", months: "أكتوبر – ديسمبر" },
] as const;

export const REVIEW_STATUSES = [
  { key: "not_started", ar: "لم يبدأ" },
  { key: "in_progress", ar: "قيد التقييم" },
  { key: "completed", ar: "مكتمل" },
  { key: "approved", ar: "معتمد" },
] as const;

export const quarterOf = (d: Date) => Math.floor(d.getMonth() / 3) + 1;

/** Sum of criteria scores, each clamped to its max — never above 100. */
export function totalScore(scores: Record<string, number>) {
  return CRITERIA.reduce((s, c) => s + Math.min(c.max, Math.max(0, Number(scores[c.key]) || 0)), 0);
}

export function grade(total: number) {
  if (total >= 90) return "ممتاز";
  if (total >= 80) return "جيد جدًا";
  if (total >= 70) return "جيد";
  if (total >= 60) return "مقبول";
  return "ضعيف";
}

/** A quarter's review is late once the quarter has ended and it is not completed/approved yet. */
export function isLate(year: number, quarter: number, status: string | null, now = new Date()) {
  const end = new Date(year, quarter * 3, 1);
  return now >= end && status !== "completed" && status !== "approved";
}
