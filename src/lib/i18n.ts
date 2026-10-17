import { useSyncExternalStore } from "react";

export type Language = "ar" | "en";
const listeners = new Set<() => void>();
let language: Language = "ar";
export const currentLanguage = () => language;
export const locale = () => language === "en" ? "en-GB" : "ar-SA-u-ca-gregory";
export function setLanguage(value: Language) {
  language = value;
  try { localStorage.setItem("metalfuze.language", value); } catch { /* Storage unavailable. */ }
  document.documentElement.lang = value;
  document.documentElement.dir = value === "ar" ? "rtl" : "ltr";
  listeners.forEach((listener) => listener());
}
export function useLanguage() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, currentLanguage, () => "ar" as Language);
}
export function initializeLanguage() {
  try { setLanguage(localStorage.getItem("metalfuze.language") === "en" ? "en" : "ar"); }
  catch { setLanguage("ar"); }
}

export const translations: Record<string, string> = {
  "تم تحصيله": "Collected", "تم دفعه للموردين": "Paid to suppliers", "المتبقي للتحصيل": "Left to collect", "صافي المشروع": "Project net",
  "قيمة العقود": "Contract value",
  "تحميل الفاتورة": "Download invoice",
  "فاتورة مشروع": "Project Invoice",
  "البند": "Item",
  "نسبة التحصيل": "Collection rate",
  "سجل الحركات": "Transaction history",
  "الختم والاعتماد": "Stamp & approval",
  "الدفع والتحصيل": "Payments & Collections", "تحصيل من العملاء ودفع للموردين لكل مسؤول مشروع": "Client collections and supplier payments per project manager",
  "كل المسؤولين": "All managers", "حركة جديدة": "New transaction", "تعديل حركة": "Edit transaction", "إجمالي التحصيل": "Total collected",
  "إجمالي الدفع": "Total paid", "الرصيد": "Balance", "حسب مسؤول المشروع": "By project manager", "عدد الحركات": "Transactions",
  "تحصيل": "Collected", "دفع": "Paid", "استلم": "Received", "كشف حساب": "Statement", "الفواتير": "Invoices", "لا توجد حركات بعد": "No transactions yet",
  "رقم الفاتورة": "Invoice no.", "التاريخ": "Date", "النوع": "Type", "العميل / المورد": "Client / Supplier", "المبلغ": "Amount", "الفاتورة": "Invoice",
  "حذف هذه الحركة؟": "Delete this transaction?", "استلمنا من (العميل)": "Received from (client)", "دفعنا إلى (المورد)": "Paid to (supplier)",
  "طريقة الدفع": "Payment method", "سند تحصيل": "Receipt Voucher", "سند دفع": "Payment Voucher", "توقيع المستلم": "Receiver signature",
  "توقيع المحاسب": "Accountant signature", "تحصيل من العميل": "Collect from client", "دفع للمورد": "Pay supplier", "العميل": "Client", "المورد": "Supplier",
  "تحويل بنكي": "Bank transfer", "تم الحفظ": "Saved", "تم التصدير": "Exported",
  "تقارير المشاريع": "Project Reports", "أسبوعي": "Weekly", "شهري": "Monthly", "سنوي": "Yearly",
  "التقرير الأسبوعي": "Weekly Report", "التقرير السنوي": "Annual Report",
  "الفترة السابقة": "Previous Period", "الفترة التالية": "Next Period", "الفترة الحالية": "Current Period",
  "اختيار تاريخ التقرير": "Select Report Date", "فترة التقرير": "Reporting Period",
  "ملخص الإدارة": "Management Summary", "مواعيد الانتهاء خلال الفترة": "Deadlines in Period",
  "أولويات المتابعة": "Follow-up Priorities", "فجوة الإنجاز": "Progress Gap",
  "لا توجد مشاريع خلال هذه الفترة": "No projects in this period", "لا توجد أولويات معلقة": "No outstanding priorities",
  "أرقام العقود والمدفوعات والإنجاز لقطة حالية تراكمية، وليست حركة مالية تاريخية للفترة.": "Contract, payment and progress figures are current cumulative snapshots, not historical transactions for the period.",
  "مشاريع دون تواريخ": "Projects without dates", "متابعة التحصيل": "Follow up payment collection",
  "معالجة تأخر التنفيذ": "Resolve execution delay", "المشاريع المتداخلة مع الفترة": "Projects overlapping period",
  "تاريخ البيانات": "Data Date", "لا توجد عوائق مسجلة": "No recorded obstacles",
  "تاريخ الإصدار:": "Issued:", "مشاريع متأخرة (": "Overdue projects (",
  "قريبة من الانتهاء (": "Ending soon (", "— متأخر": "— overdue ", "— باقي": "— remaining ",
  "يوم": "days", "جميع المشاريع (": "All Projects (", "عدد المشاريع": "Project Count",
  "تم تحديث البيانات:": "Data updated:", "مشروع": "projects",
  "تم اعتماد صرف الرواتب": "Payroll marked paid for", "حذف حساب": "Delete account",
  "تم حذف": "Deleted", "كلمة السر الجديدة لـ": "New password for", "8 أحرف على الأقل": "At least 8 characters",
  "تم إنشاء حساب": "Account created",
  "لم يتم العثور على عمود اسم المشروع": "Project Name column not found",
  "حالة": "Status ", " — الصرف أعلى من الإنجاز": " — Spending exceeds progress",
  "Metal Fuze — مستند رسمي صادر من نظام متابعة المشاريع": "Metal Fuze — Official Projects Report",
  "لوحة متابعة المشاريع": "METAL FUZE PROJECTS",
  "لوحة المشاريع": "Projects", "اللوحة": "Projects",
  "المستشار الذكي": "AI Advisor", "الرواتب": "Payroll", "الميزانية": "Budget",
  "تحديث من ملف Excel": "Import Excel", "تصدير تقرير Excel": "Export Excel Report",
  "مشروع جديد": "New Project", "حفظ PDF": "Save PDF", "جارٍ تجهيز PDF…": "Preparing PDF…",
  "تم حفظ PDF": "PDF saved", "تعذر حفظ PDF، حاول مرة أخرى": "Unable to save PDF. Please try again.",
  "إجمالي المشاريع": "Total Projects", "إجمالي قيمة العقود": "Total Contract Value", "المدفوع": "Paid",
  "المتبقي للدفع": "Remaining Payment", "ريال": "SAR", "ر.س": "SAR",
  "الكل": "All", "طبيعي": "On Track", "متقدم": "Ahead", "متأخر": "Delayed",
  "حالة المشاريع": "Project Status", "قيمة العقود حسب القطاع": "Contract Value by Sector",
  "المشاريع لكل مدير": "Projects by Manager", "الإنجاز الفعلي مقابل المخطط": "Actual vs Planned Progress",
  "الرمز": "Code", "المشروع": "Project", "القطاع": "Sector", "المدير": "Manager",
  "الانتهاء": "End Date", "الحالة": "Status", "الإنجاز": "Progress", "قيمة العقد": "Contract Value",
  "بحث...": "Search…", "تعديل": "Edit", "حذف": "Delete", "فعلي": "Actual", "مخطط": "Planned", "القيمة": "Value",
  "انتهى": "Expired", "متبقي أقل من شهر": "Less than a month left", "ساري": "Active",
  "غير محدد": "Unspecified", "سكني": "Residential", "تجاري": "Commercial", "مكتبي": "Office",
  "فندقي": "Hotel", "خاص": "Private", "خدمات": "Services", "صحي": "Healthcare", "مطاعم": "Restaurants",
  "فندقي + سكني": "Hotel / Residential", "نعم": "Yes", "لا": "No",
  "تعديل مشروع": "Edit Project", "إضافة مشروع جديد": "Add New Project", "اسم المشروع": "Project Name",
  "رمز المشروع": "Project Code", "الإدارة": "Department", "مدير المشروع": "Project Manager", "مالك المشروع": "Project Owner",
  "تاريخ البداية": "Start Date", "تاريخ الانتهاء": "End Date", "حالة المشروع": "Project Status",
  "هل يوجد عقد شركة": "Company Contract", "نسبة الإنجاز %": "Progress %", "نسبة الإنجاز المخطط %": "Planned Progress %",
  "الإشكاليات / العوائق": "Issues / Obstacles", "ملاحظات مهمة": "Important Notes", "ملاحظات": "Notes",
  "إلغاء": "Cancel", "حفظ": "Save", "تسجيل الدخول": "Sign In", "اسم المستخدم": "Username",
  "كلمة المرور": "Password", "دخول": "Sign In", "جارٍ الدخول...": "Signing in…", "أو": "or",
  "الدخول بحساب جوجل": "Sign in with Google", "جارٍ فتح جوجل...": "Opening Google…",
  "اسم المستخدم أو كلمة المرور غير صحيحة": "Incorrect username or password",
  "تعذر الدخول بحساب جوجل، حاول مرة أخرى": "Google sign-in failed. Please try again.",
  "المستخدمون": "Users", "خروج": "Sign Out", "مرحباً،": "Welcome,", "القائمة": "Menu",
  "وحدة الرواتب": "Payroll", "مسير الرواتب الشهري وحالة الصرف لكل موظف": "Monthly payroll and employee payment status",
  "التقرير الشهري": "Monthly Report", "تصدير مسير Excel": "Export Payroll Excel", "إضافة موظف": "Add Employee",
  "الشهر التالي": "Next Month", "الشهر السابق": "Previous Month", "الشهر الحالي": "Current Month",
  "إجمالي رواتب الشهر": "Total Monthly Payroll", "الموظفون النشطون": "Active Employees", "تم صرفه": "Paid",
  "المتبقي للصرف": "Remaining to Pay", "بحث بالاسم أو الإدارة أو المشروع…": "Search name, department or project…",
  "اعتماد صرف الشهر للجميع": "Mark Month Paid for All", "الموظف": "Employee", "الإدارة / المشروع": "Department / Project",
  "الأساسي": "Base Salary", "البدلات": "Allowances", "الخصومات": "Deductions", "الصافي": "Net Salary",
  "إجراءات": "Actions", "إلغاء الصرف": "Undo Payment", "اعتماد الصرف": "Mark Paid", "مدفوع ✓": "Paid ✓",
  "قيد الصرف": "Pending", "غير نشط": "Inactive", "لا توجد نتائج مطابقة": "No matching results",
  "تم حذف الموظف": "Employee deleted", "تم تحديث بيانات الموظف": "Employee updated", "تمت إضافة الموظف": "Employee added",
  "تعديل موظف": "Edit Employee", "اسم الموظف": "Employee Name", "المسمى الوظيفي": "Job Title",
  "المشروع (اختياري)": "Project (Optional)", "الراتب الأساسي": "Base Salary", "تاريخ التعيين": "Joining Date",
  "موظف نشط (يظهر في مسير الرواتب)": "Active Employee (Included in Payroll)",
  "التقرير الشهري: الرواتب والمشاريع": "Monthly Report: Payroll & Projects",
  "كل موظف مع مشروعه، الإنجاز، الصرف والراتب الصافي": "Employees, projects, progress, spending and net salaries",
  "تصدير Excel": "Export Excel", "إجمالي الرواتب الصافية": "Total Net Salaries", "المصروف من الرواتب": "Paid Salaries",
  "تفاصيل الموظفين": "Employee Details", "صرف العقد": "Contract Spending", "الراتب الصافي": "Net Salary",
  "حالة الراتب": "Payment Status", "مدفوع": "Paid", "غير مدفوع": "Unpaid", "إدارة عامة": "General Administration",
  "إدارة عامة (بدون مشروع)": "General Administration (No Project)", "تكلفة الرواتب حسب المشروع": "Payroll Cost by Project",
  "عدد الموظفين": "Employee Count", "إجمالي الرواتب": "Total Payroll", "لوحة الميزانية": "Budget Overview",
  "تتحدث تلقائياً من بيانات المشاريع والرواتب": "Updated from project and payroll data",
  "إجمالي العقود": "Total Contracts", "المصروف من العقود": "Contract Spending", "صرف الرواتب الشهري": "Monthly Payroll",
  "الميزانية حسب المشروع": "Budget by Project", "المصروف": "Spent", "نسبة الصرف": "Spending %",
  "موظفون": "Employees", "رواتب الشهر": "Monthly Salaries", "رواتب إدارة عامة (غير مرتبطة بمشروع)": "General Administration Payroll (No Project)",
  "تفعيل الوضع الفاتح": "Enable Light Mode", "تفعيل الوضع الداكن": "Enable Dark Mode", "الوضع الفاتح": "Light Mode",
  "الوضع الداكن": "Dark Mode", "فاتح": "Light", "داكن": "Dark",
  "إدارة المستخدمين": "User Management", "تعذر تحميل المستخدمين": "Unable to load users", "لم يدخل بعد": "Never signed in",
  "إضافة حساب جديد": "Add New Account", "الاسم المعروض": "Display Name", "اسم المستخدم (إنجليزي)": "Username (English)",
  "كلمة السر": "Password", "توليد": "Generate", "جارٍ الإنشاء...": "Creating…", "إنشاء الحساب": "Create Account",
  "الاسم": "Name", "تاريخ الإنشاء": "Created", "آخر دخول": "Last Sign-in", "جارٍ التحميل...": "Loading…", "(أنت)": "(You)",
  "كلمة السر تظهر مرة واحدة فقط عند الإنشاء أو التغيير — سلّمها لصاحب الحساب مباشرة.": "Passwords are shown only once when created or changed — hand them directly to the account owner.",
  "محادثة جديدة": "New Conversation", "حذف المحادثة": "Delete Conversation",
  "يحلل بيانات اللوحة الحالية ويقدم توصيات": "Analyses current project data and provides recommendations",
  "اسأل عن مشاريعك": "Ask About Your Projects", "أجيبك من البيانات الموجودة في اللوحة حالياً": "Answers based on your current project data",
  "جارٍ تحليل بيانات المشاريع...": "Analysing project data…", "مثال: ما المشاريع المتأخرة وما الحل؟": "Example: Which projects are delayed and what can we do?",
  "ما المشاريع الأكثر خطورة الآن ولماذا؟": "Which projects are most at risk and why?",
  "قارن الإنجاز الفعلي بالمخطط لكل مشروع": "Compare actual and planned progress for each project",
  "أين توجد فجوات في التحصيل المالي؟": "Where are the gaps in payment collection?",
  "ما أولويات الإدارة لهذا الأسبوع؟": "What are management's priorities this week?",
  "طلبات كثيرة، حاول بعد قليل": "Too many requests. Try again shortly.",
  "نفد رصيد الذكاء الاصطناعي، أضف رصيداً من إعدادات مساحة العمل": "AI credits exhausted. Add credits in workspace settings.",
  "تعذر الحصول على إجابة، تحقق من الاتصال": "Unable to get an answer. Check your connection.",
  "تم تصدير التقرير": "Report exported", "تعذر التصدير": "Export failed", "تم تصدير تقرير Excel": "Excel report exported",
  "تم تصدير مسير الرواتب": "Payroll exported", "المشاريع": "Projects", "ملخص": "Summary", "الملخص التنفيذي": "Executive Summary",
  "تقرير متابعة المشاريع": "METAL FUZE PROJECTS", "تفاصيل المشاريع": "Project Details", "الأيام المتبقية": "Days Remaining",
  "حالة الموعد": "Deadline Status", "نسبة الإنجاز": "Progress %", "الإنجاز المخطط": "Planned Progress",
  "المشاريع المكتملة": "Completed Projects", "المشاريع المتأخرة": "Delayed Projects", "متوسط الإنجاز": "Average Progress",
  "إجمالي المدفوع": "Total Paid", "الإجمالي": "Total", "الموظفون": "Employees", "حسب المشروع": "By Project",
  "المسمى": "Role", "المصروف من العقد": "Contract Spending", "تفاصيل الموظفين والمشاريع": "Employee & Project Details",
  "الرواتب حسب المشروع": "Payroll by Project", "إجمالي صافي الرواتب": "Total Net Salaries", "مسير الرواتب": "Payroll Register",
  "لوحة متابعة مشاريع Metal Fuze": "METAL FUZE PROJECTS",
  "إخفاء القائمة": "Hide Menu", "إظهار القائمة": "Show Menu",
};

/** UI labels only: never translate or mutate user-entered names, notes or credentials. */
export function t(text: string): string {
  if (text === "لوحة متابعة المشاريع" || text === "تقرير متابعة المشاريع") return "METAL FUZE PROJECTS";
  return language === "en" ? (translations[text] ?? text) : text;
}