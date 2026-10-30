# Graph Report - src  (2026-10-30)

## Corpus Check
- 288 files · ~152,712 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: .css 1)

## Summary
- 1982 nodes · 6714 edges · 81 communities (74 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 77 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- components: prompt-input
- lib: bank
- components: menubar
- components: AdvancesCommissions
- routeTree.gen.ts: routeTree
- components: FinancialGuarantees
- routes: custody
- routes: leaves
- lib: payroll
- lib: AccountSwitcher
- components: attendance
- components: message
- components: conversation
- lib: outlook
- components: sidebar
- lib: cp
- components: cp
- components: dev
- components: ResidenciesPanel
- lib: permissions
- lib: transactions
- components: leave
- routes: project-admin_
- lib: sidebar
- routes: sales
- components: ExecCharts
- routes: establishment
- components: cp
- routes: performance
- routes: hr-file
- routes: index
- components: navigation-menu
- components: 
- lib: error-capture
- components: alert-dialog
- lib: checkin-link
- components: CpReportsTab
- routes: fleet
- lib: projects
- components: AppSidebar
- lib: branded-excel
- lib: supabase
- lib: project-report
- lib: idle-signout
- components: carousel
- components: form
- routes: payments
- routes: preview
- routes: est-payroll
- components: chart
- lib: access-rules
- lib: advances
- components: AutoTranslate
- integrations: previewAuthStorage
- lib: threads
- integrations: types
- lib: bloom
- lib: consistent-hash
- lib: leave
- lib: email-change
- lib: invite
- lib: magic-link
- lib: signup
- lib: read-cache
- components: input-group
- lib: nationalities
- lib: reauthentication
- lib: recovery
- lib: lovable-error-reporting
- routes: leave
- components: AdvancesCommissions
- routes: cdata
- router.tsx: router
- integrations: index
- routes: preview
- routes: privacy
- routes: tts
- routes: [

## God Nodes (most connected - your core abstractions)
1. `cn()` - 278 edges
2. `t()` - 258 edges
3. `Button` - 187 edges
4. `useLanguage()` - 131 edges
5. `Input` - 111 edges
6. `supabase` - 70 edges
7. `DialogContent` - 69 edges
8. `DialogHeader()` - 66 edges
9. `DialogTitle` - 66 edges
10. `locale()` - 66 edges

## Surprising Connections (you probably didn't know these)
- `send()` --indirect_call--> `me()`  [INFERRED]
  routes/messages.tsx → components/BugReport.tsx
- `go()` --calls--> `t()`  [EXTRACTED]
  components/ManualPunch.tsx → lib/i18n.ts
- `save()` --calls--> `t()`  [EXTRACTED]
  components/ResidenciesPanel.tsx → lib/i18n.ts
- `MessageActions()` --calls--> `cn()`  [EXTRACTED]
  components/ai-elements/message.tsx → lib/utils.ts
- `MessageBranch()` --calls--> `cn()`  [EXTRACTED]
  components/ai-elements/message.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (81 total, 7 thin omitted)

### Community 0 - "components: prompt-input"
Cohesion: 0.02
Nodes (86): AttachmentsContext, captureScreenshot(), convertBlobUrlToDataUrl(), LocalAttachmentsContext, LocalReferencedSourcesContext, PromptInput(), PromptInputActionAddAttachments(), PromptInputActionAddAttachmentsProps (+78 more)

### Community 1 - "lib: bank"
Cohesion: 0.05
Nodes (66): createSupabaseFetch(), isNewSupabaseApiKey(), requireSupabaseAuth, createSupabaseAdminClient(), createSupabaseFetch(), isNewSupabaseApiKey(), supabaseAdmin, BankTxn (+58 more)

### Community 2 - "components: menubar"
Cohesion: 0.04
Nodes (62): PromptInputActionMenuContent(), AccordionContent, AccordionItem, AccordionTrigger, Avatar, AvatarFallback, AvatarImage, Breadcrumb (+54 more)

### Community 3 - "components: AdvancesCommissions"
Cohesion: 0.08
Nodes (45): PAGES, Row, Act, TABLE, CFG, Field, Kind, Row (+37 more)

### Community 4 - "routeTree.gen.ts: routeTree"
Cohesion: 0.03
Nodes (64): Route, Route, Route, Route, AccountingRoute, ApiChatRoute, ApiOauthOutlookReturnRoute, ApiPublicCheckinRoute (+56 more)

### Community 5 - "components: FinancialGuarantees"
Cohesion: 0.12
Nodes (44): BugReportButton(), fileAuto(), me(), sent, InvoiceDialog(), DailyDialog(), ActDialog(), SubmissionDialog() (+36 more)

### Community 6 - "routes: custody"
Cohesion: 0.06
Nodes (53): save(), EmployeeSignature(), download(), remove(), save(), ProjectFiles(), remove(), removeCategory() (+45 more)

### Community 7 - "routes: leaves"
Cohesion: 0.08
Nodes (52): Lite, approvedLeaveDates(), countLeaveDays(), eachDay(), entitlementFor(), iso(), LEAVE_STATES, leaveError() (+44 more)

### Community 8 - "lib: payroll"
Cohesion: 0.10
Nodes (44): fmt(), EmployeeDialog(), empty, MonthlySheet(), PdfButton(), ThemeToggle(), locale(), useApprovedLeaves() (+36 more)

### Community 9 - "lib: AccountSwitcher"
Cohesion: 0.07
Nodes (40): AccountSwitcher(), add(), forget(), switchTo(), nameOf(), read(), remember(), Saved (+32 more)

### Community 10 - "components: attendance"
Cohesion: 0.09
Nodes (39): AttendanceMap(), draw(), esc(), Leaflet, MapState, esc(), LivePoint, LiveTrackMap() (+31 more)

### Community 11 - "components: message"
Cohesion: 0.05
Nodes (34): MessageAction(), MessageActionProps, MessageActions(), MessageActionsProps, MessageBranch(), MessageBranchContent(), MessageBranchContentProps, MessageBranchContext (+26 more)

### Community 12 - "components: conversation"
Cohesion: 0.08
Nodes (37): Conversation(), ConversationContent(), ConversationContentProps, ConversationDownload(), ConversationDownloadProps, ConversationEmptyState(), ConversationEmptyStateProps, ConversationProps (+29 more)

### Community 13 - "lib: outlook"
Cohesion: 0.08
Nodes (35): AppUserOAuthAuthorizeParams, AppUserOAuthAuthorizeResponse, authorizeAppUserOAuth(), callAsAppUser(), CallAsAppUserParams, disconnectAppUser(), DisconnectAppUserParams, exchangeAppUserOAuthCode() (+27 more)

### Community 14 - "components: sidebar"
Cohesion: 0.07
Nodes (36): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants (+28 more)

### Community 15 - "lib: cp"
Cohesion: 0.10
Nodes (36): actKey(), CpScheduleTab(), fetchActs(), Gantt(), Stat(), ACCESS_ROLES, canResubmit(), codeColorVar (+28 more)

### Community 16 - "components: cp"
Cohesion: 0.18
Nodes (31): CpInvoicesTab(), Draft, invKey(), Empty(), PeriodView(), SubTable(), CodeBadge(), CpSubmissionsTab() (+23 more)

### Community 17 - "components: dev"
Cohesion: 0.13
Nodes (28): AccessControl(), empty(), ActivityMonitor(), AccountAudit(), DevHealth(), dur(), EmployeeLogins(), fmt() (+20 more)

### Community 18 - "components: ResidenciesPanel"
Cohesion: 0.14
Nodes (26): DocsOverview(), Row, Cell(), DateCell(), DocBar(), EditDialog(), save(), FIELDS (+18 more)

### Community 19 - "lib: permissions"
Cohesion: 0.13
Nodes (27): AuthGate(), Login(), onGoogle(), onSubmit(), RoleGuard(), toEmail(), logLoginEvent, signOutTracked() (+19 more)

### Community 20 - "lib: transactions"
Cohesion: 0.09
Nodes (19): ExecSnapshotSync(), Kind, mergeRemote(), Pending, readJson(), Row, uniqByName(), projectChanges (+11 more)

### Community 21 - "components: leave"
Cohesion: 0.16
Nodes (23): LanguageToggle(), parseCoords(), RemoteLinks(), useSites(), WorkSites(), add(), SelfieCheckin(), onPhoto() (+15 more)

### Community 22 - "routes: project-admin_"
Cohesion: 0.07
Nodes (29): Route, Route, Route, Route, Route, Route, Route, Route (+21 more)

### Community 23 - "lib: sidebar"
Cohesion: 0.11
Nodes (20): AssistantFab(), PrintLetterhead(), Toaster(), ToasterProps, clearPrivateDeviceData(), installAccountScope(), PRIVATE_PREFIXES, initializeLanguage() (+12 more)

### Community 24 - "routes: sales"
Cohesion: 0.10
Nodes (20): OtherSelect(), commissionDue(), blank(), D, F, fmt(), href(), LogE (+12 more)

### Community 25 - "components: ExecCharts"
Cohesion: 0.18
Nodes (21): axis, C, Card(), ExecCharts(), tip, devTxt(), downloadProjectPdf(), ProjectDetails() (+13 more)

### Community 26 - "routes: establishment"
Cohesion: 0.12
Nodes (23): ACTIVE_STATUS, CONTRACT_TYPES, contractOptions(), EMPLOYEE_STATUSES, EmployeeStatusDef, resolveEmployeeStatus(), statusLabel(), statusOptions() (+15 more)

### Community 27 - "components: cp"
Cohesion: 0.21
Nodes (21): CpContractTab(), empty(), FileKey, FILES, Tot(), CpOverview(), Fld(), OrgChart() (+13 more)

### Community 28 - "routes: performance"
Cohesion: 0.15
Nodes (22): Review, CRITERIA, grade(), isLate(), quarterOf(), QUARTERS, REVIEW_STATUSES, totalScore() (+14 more)

### Community 29 - "routes: hr-file"
Cohesion: 0.13
Nodes (20): EmployeeReviews(), HrKey, HrRow, importHrFile, Cert, CertificatesBox(), del(), persist() (+12 more)

### Community 30 - "routes: index"
Cohesion: 0.15
Nodes (21): exportExcel(), addYears(), daysLeft(), deadlineAlert(), importExcel(), minusMonth(), warrantyInfo, exportAll() (+13 more)

### Community 31 - "components: navigation-menu"
Cohesion: 0.11
Nodes (16): Alert, AlertDescription, AlertTitle, alertVariants, NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList (+8 more)

### Community 32 - "components: "
Cohesion: 0.09
Nodes (8): Progress, RadioGroup, RadioGroupItem, ScrollArea, ScrollBar, Slider, Spinner(), Switch

### Community 33 - "lib: error-capture"
Cohesion: 0.13
Nodes (16): attachSupabaseAuth, consumeLastCapturedError(), describeError(), describeStatus(), originalConsoleError, safeStringify(), renderErrorPage(), CSP (+8 more)

### Community 34 - "components: alert-dialog"
Cohesion: 0.12
Nodes (19): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+11 more)

### Community 35 - "lib: checkin-link"
Cohesion: 0.11
Nodes (17): button, container, h1, main, muted, Props, template, text (+9 more)

### Community 36 - "components: CpReportsTab"
Cohesion: 0.23
Nodes (16): CpReportsTab(), dailyKey(), DailyList(), DailyView(), mp(), photosOf(), ReportHead(), Sec() (+8 more)

### Community 37 - "routes: fleet"
Cohesion: 0.12
Nodes (18): CAR_STATUSES, carCls, CarRow, Emp, emptyCar(), emptyVio(), F(), FleetPage() (+10 more)

### Community 38 - "lib: projects"
Cohesion: 0.13
Nodes (15): b, CLIENT_CAPACITIES, Deviation, listeners, load(), OUR_ROLES, plannedFromDates(), save() (+7 more)

### Community 39 - "components: AppSidebar"
Cohesion: 0.15
Nodes (14): AppSidebar(), BottomBar(), items, Logo(), NavLinks(), NotifyButton(), useNavItems(), MessageAlerts() (+6 more)

### Community 40 - "lib: branded-excel"
Cohesion: 0.16
Nodes (10): Col, exportBrandedExcel(), fmt(), getLogo(), KV, SheetSpec, downloadBlob(), exportElementPdf() (+2 more)

### Community 41 - "lib: supabase"
Cohesion: 0.25
Nodes (8): configuredEnv(), runtimeEnv(), RuntimeGlobals, supabaseForUser(), supabaseProjectUrl(), supabasePublishableKey(), Route, Route

### Community 42 - "lib: project-report"
Cohesion: 0.23
Nodes (10): PopoverContent, buildProjectReport(), periodLabels, periodRange(), ReportPeriod, shiftPeriod(), Project, useProjects() (+2 more)

### Community 43 - "lib: idle-signout"
Cohesion: 0.25
Nodes (11): ACTIVITY_EVENTS, IdleSignOut(), shouldForceOut(), ACTIVITY_KEY, IDLE_MS, idleExpired(), readLastActivity(), NOW (+3 more)

### Community 44 - "components: carousel"
Cohesion: 0.17
Nodes (13): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+5 more)

### Community 45 - "components: form"
Cohesion: 0.19
Nodes (10): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+2 more)

### Community 46 - "routes: payments"
Cohesion: 0.41
Nodes (13): totals(), useTransactions(), bi(), Doc, fmtDate(), InvoicePaper(), PaperHeader(), Payments() (+5 more)

### Community 47 - "routes: preview"
Cohesion: 0.29
Nodes (11): RFC-6761, EmailChangeEmail(), InviteEmail(), MagicLinkEmail(), ReauthenticationEmail(), RecoveryEmail(), SignupEmail(), EMAIL_TEMPLATES (+3 more)

### Community 48 - "routes: est-payroll"
Cohesion: 0.27
Nodes (11): useCanEditHr(), D, EstPayrollPage(), remove(), save(), fmt(), N(), netOf() (+3 more)

### Community 49 - "components: chart"
Cohesion: 0.24
Nodes (10): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartStyle(), ChartTooltipContent, getPayloadConfigFromPayload() (+2 more)

### Community 50 - "lib: access-rules"
Cohesion: 0.27
Nodes (9): checkMyAccess, AccessRules, checkAccess(), DAY_NAMES, deviceKind(), riyadhClock(), base, tue9 (+1 more)

### Community 51 - "lib: advances"
Cohesion: 0.23
Nodes (7): Adj, adjMonth(), AdjRow, computeAdjustments(), n(), useAdjustments(), base

### Community 52 - "components: AutoTranslate"
Cohesion: 0.24
Nodes (10): ATTRS, AutoTranslate(), cache, flush(), inflight, lookup(), pending, queue() (+2 more)

### Community 53 - "integrations: previewAuthStorage"
Cohesion: 0.20
Nodes (10): createSupabaseClient(), createSupabaseFetch(), isNewSupabaseApiKey(), serverSupabaseUrl(), brokeredPreviewStorage(), BrokerReply, BrokerRequest, BrokerRequestType (+2 more)

### Community 54 - "lib: threads"
Cohesion: 0.22
Nodes (7): EMPTY, listeners, load(), Thread, threadStore, useThreads(), Route

### Community 55 - "integrations: types"
Cohesion: 0.20
Nodes (9): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json, TablesInsert (+1 more)

### Community 56 - "lib: bloom"
Cohesion: 0.38
Nodes (4): BloomFilter, findDuplicate(), normKey(), save()

### Community 58 - "lib: leave"
Cohesion: 0.40
Nodes (7): daysInMonth(), DIM, LEAVE_COLS, leaveDays(), leaveStatus, monthLast(), toIso()

### Community 59 - "lib: email-change"
Cohesion: 0.22
Nodes (8): button, container, EmailChangeEmailProps, footer, h1, link, main, text

### Community 60 - "lib: invite"
Cohesion: 0.22
Nodes (8): button, container, footer, h1, InviteEmailProps, link, main, text

### Community 61 - "lib: magic-link"
Cohesion: 0.22
Nodes (7): button, container, footer, h1, MagicLinkEmailProps, main, text

### Community 62 - "lib: signup"
Cohesion: 0.22
Nodes (8): button, container, footer, h1, link, main, SignupEmailProps, text

### Community 63 - "lib: read-cache"
Cohesion: 0.28
Nodes (6): createReadCache(), Entry, installReadCache(), READ_TTL_MS, readCache, tableOf()

### Community 64 - "components: input-group"
Cohesion: 0.32
Nodes (7): PromptInputHeader(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText()

### Community 65 - "lib: nationalities"
Cohesion: 0.43
Nodes (3): NationalitySelect(), NATIONALITIES, nationalityValue()

### Community 66 - "lib: reauthentication"
Cohesion: 0.25
Nodes (7): codeStyle, container, footer, h1, main, ReauthenticationEmailProps, text

### Community 67 - "lib: recovery"
Cohesion: 0.25
Nodes (7): button, container, footer, h1, main, RecoveryEmailProps, text

### Community 68 - "lib: lovable-error-reporting"
Cohesion: 0.33
Nodes (6): describeThrown(), LovableErrorOptions, LovableEvents, reportLovableError(), Window, ErrorComponent()

### Community 69 - "routes: leave"
Cohesion: 0.57
Nodes (6): admin(), byToken(), json(), Route, validDate(), validToken()

### Community 70 - "components: AdvancesCommissions"
Cohesion: 0.40
Nodes (4): AdvancesCommissions(), save(), n(), sar()

### Community 71 - "routes: cdata"
Cohesion: 0.60
Nodes (5): parseAttlog(), device(), ipAllowed(), Route, text()

### Community 72 - "router.tsx: router"
Cohesion: 0.33
Nodes (4): getRouter(), Register, routeTree, startInstance

### Community 73 - "integrations: index"
Cohesion: 0.40
Nodes (3): lovable, lovableAuth, SignInOptions

### Community 77 - "routes: ["
Cohesion: 1.00
Nodes (3): Consent(), decide(), oauth()

## Knowledge Gaps
- **1 isolated node(s):** `RFC-6761`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 568 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `components: menubar` to `components: prompt-input`, `components: AdvancesCommissions`, `components: FinancialGuarantees`, `components: message`, `components: conversation`, `components: sidebar`, `components: cp`, `components: dev`, `components: ResidenciesPanel`, `components: cp`, `components: navigation-menu`, `components: `, `components: alert-dialog`, `components: CpReportsTab`, `lib: project-report`, `components: carousel`, `components: form`, `components: chart`, `components: input-group`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **What connects `RFC-6761` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `components: prompt-input` be split into smaller, more focused modules?**
  _Cohesion score 0.0248319641523525 - nodes in this community are weakly interconnected._
- **Why does `t()` connect `routes: custody` to `lib: bank`, `components: AdvancesCommissions`, `components: FinancialGuarantees`, `routes: leaves`, `lib: payroll`, `lib: AccountSwitcher`, `components: attendance`, `components: conversation`, `components: dev`, `components: ResidenciesPanel`, `lib: permissions`, `lib: transactions`, `components: leave`, `lib: sidebar`, `routes: sales`, `components: ExecCharts`, `routes: establishment`, `routes: performance`, `routes: index`, `routes: fleet`, `lib: projects`, `components: AppSidebar`, `lib: branded-excel`, `lib: project-report`, `lib: idle-signout`, `routes: payments`, `routes: est-payroll`, `lib: nationalities`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Should `lib: bank` be split into smaller, more focused modules?**
  _Cohesion score 0.05025394279604384 - nodes in this community are weakly interconnected._
- **Why does `Button` connect `components: dev` to `components: menubar`, `components: AdvancesCommissions`, `components: FinancialGuarantees`, `routes: custody`, `routes: leaves`, `lib: payroll`, `lib: AccountSwitcher`, `components: attendance`, `components: message`, `components: conversation`, `lib: outlook`, `components: sidebar`, `lib: cp`, `components: cp`, `components: ResidenciesPanel`, `lib: permissions`, `components: leave`, `lib: sidebar`, `routes: sales`, `components: ExecCharts`, `routes: establishment`, `components: cp`, `routes: performance`, `routes: hr-file`, `routes: index`, `components: alert-dialog`, `components: CpReportsTab`, `routes: fleet`, `components: AppSidebar`, `lib: project-report`, `components: carousel`, `routes: payments`, `routes: est-payroll`, `components: input-group`, `lib: nationalities`, `components: AdvancesCommissions`, `routes: [`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Should `components: menubar` be split into smaller, more focused modules?**
  _Cohesion score 0.037756497948016415 - nodes in this community are weakly interconnected._