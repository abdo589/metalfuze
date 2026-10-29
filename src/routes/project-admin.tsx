import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/project-admin")({
  head: () => ({
    meta: [
      { title: "إدارة مشاريع — Metal Fuze" },
      { name: "description", content: "مساحة إدارة المشاريع في Metal Fuze." },
      { property: "og:title", content: "إدارة مشاريع — Metal Fuze" },
      { property: "og:description", content: "مساحة إدارة المشاريع في Metal Fuze." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectAdminPage,
});

function ProjectAdminPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground">إدارة مشاريع</h1>
    </div>
  );
}
