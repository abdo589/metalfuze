import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/residencies")({
  head: () => ({ meta: [
    { title: "الإقامات — Metal Fuze" },
    { name: "description", content: "متابعة إقامات الموظفين ووثائقهم ومواعيد انتهائها في Metal Fuze." },
    { property: "og:title", content: "الإقامات — Metal Fuze" },
    { property: "og:description", content: "متابعة إقامات الموظفين ووثائقهم ومواعيد انتهائها." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => { throw redirect({ to: "/hr-file" }); },
});
