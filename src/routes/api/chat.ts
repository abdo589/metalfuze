import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage } from "ai";
import { createResponsesCall } from "@/server/ai/responses";

const INSTRUCTIONS = `أنت "مستشار Metal Fuze"، محلل مشاريع إنشائية يساعد الإدارة.
- أجب دائماً بالعربية وباختصار ووضوح، واستخدم عناوين ونقاطاً وجداول Markdown عند الحاجة.
- اعتمد فقط على بيانات المشاريع المرفقة (JSON). لا تخترع أرقاماً؛ إذا كانت معلومة غير متوفرة فقل ذلك.
- progress وplanned نسب من 0 إلى 1 (اعرضها كنسب مئوية). المبالغ بالريال السعودي.
- daysLeft سالب يعني أن الموعد النهائي فات.
- اختم كل إجابة تحليلية بقسم "توصيات عملية" فيه خطوات محددة قابلة للتنفيذ (من المسؤول، ماذا يفعل، الأولوية).`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("مفتاح الذكاء الاصطناعي غير مهيأ", { status: 500 });
        let body: { messages?: UIMessage[]; projects?: unknown[]; today?: string };
        try { body = await request.json(); } catch { return new Response("طلب غير صالح", { status: 400 }); }
        const messages = Array.isArray(body.messages) ? body.messages.slice(-40) : [];
        if (!messages.length) return new Response("لا توجد رسائل", { status: 400 });
        const projects = Array.isArray(body.projects) ? body.projects.slice(0, 500) : [];
        const data = JSON.stringify(projects).slice(0, 150_000);
        const instructions = `${INSTRUCTIONS}\n\nتاريخ اليوم: ${body.today ?? new Date().toISOString().slice(0, 10)}\nبيانات المشاريع الحالية من اللوحة:\n${data}`;
        const call = createResponsesCall(
          request,
          { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" },
          await convertToModelMessages(messages),
          instructions,
          messages,
        );
        return call.response();
      },
    },
  },
});
