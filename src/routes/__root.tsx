import { PrintLetterhead } from "@/components/PrintLetterhead";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { AuthGate } from "@/components/AuthGate";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { themeScript } from "../lib/theme";
import { initializeSidebar, sidebarScript } from "../lib/sidebar";
import { initializeLanguage, useLanguage } from "@/lib/i18n";
import { AppSidebar } from "@/components/AppSidebar";
import { IdleSignOut } from "@/components/IdleSignOut";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google-site-verification", content: "j4nvYMQJ-300MMpJY32-QHHT8bIgWgLG4nfR96U6N_0" },
      { title: "Metal Fuze — متابعة المشاريع" },
      { name: "theme-color", content: "#0f7f7c" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Metal Fuze" },
      { name: "description", content: "لوحة متابعة مشاريع Metal Fuze" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=Tajawal:wght@500;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const language = useLanguage();
  return (
    <html lang={language} dir={language === "en" ? "ltr" : "rtl"} suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Applies the saved light/dark choice before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Applies the saved sidebar show/hide choice before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: sidebarScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { initializeLanguage(); initializeSidebar(); }, []);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Personal phone check-in links are opened by employees without accounts.
  if (pathname.startsWith("/checkin/") || pathname.startsWith("/leave/") || pathname === "/privacy") return (
    <>
      <Outlet />
      <Toaster position="top-center" richColors />
    </>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <IdleSignOut />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <AuthGate>
        <div data-report-document>
        <PrintLetterhead />
        <div className="flex min-h-screen flex-col lg:flex-row">
          <AppSidebar />
          <main className="min-w-0 flex-1">
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
          </main>
        </div>
        </div>
      </AuthGate>
      <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground print:hidden">
        © Metal Fuze · <Link to="/privacy" className="underline hover:text-foreground">سياسة الخصوصية</Link>
      </footer>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
