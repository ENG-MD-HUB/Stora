/* STORA v2.0 — Arabic UI layer, offline indicator, service worker registration.
   Loaded after the main bundle. Translates interface text only when Arabic is selected. */
(function () {
  "use strict";
  var AR = {
    // Navigation & layout
    "Dashboard": "الرئيسية", "Storages": "أماكن التخزين", "Storage": "مكان التخزين", "Items": "الأصناف",
    "Inventory": "المخزون", "Reports": "التقارير", "Users": "المستخدمون", "Logs": "السجل", "Settings": "الإعدادات",
    "Companies": "الشركات", "Notifications": "الإشعارات", "Team": "الفريق", "Activity": "النشاط",
    "Activity Logs": "سجل النشاط", "Sign Out": "تسجيل الخروج", "Sign out": "تسجيل الخروج", "Warehouse Management": "إدارة المستودعات",
    "Warehouse Management System": "نظام إدارة المستودعات", "Quick Actions": "إجراءات سريعة",
    "Good morning": "صباح الخير", "Good afternoon": "مساء الخير", "Good evening": "مساء الخير",
    "Welcome to STORA": "مرحباً بك في STORA", "View all": "عرض الكل", "View all →": "عرض الكل ←", "All →": "الكل ←",
    "Recent Items": "أحدث الأصناف", "Recent Activity": "آخر النشاطات", "Recent Withdrawals": "آخر عمليات الصرف", "Recent": "الأحدث",
    "Total Items": "إجمالي الأصناف", "Total Units": "إجمالي الوحدات", "Total Warehouses": "إجمالي المستودعات",
    "Total Withdrawals": "إجمالي عمليات الصرف", "Low Stock": "مخزون منخفض", "Out of Stock": "نفد المخزون",
    "Low Stock Alerts": "تنبيهات المخزون المنخفض", "Low Stock Alert": "تنبيه مخزون منخفض", "In stock": "متوفر",
    "Needs attention": "يحتاج متابعة", "All items are well-stocked": "جميع الأصناف متوفرة بكميات جيدة",
    "Start by creating a warehouse, then add your inventory items.": "ابدأ بإنشاء مكان تخزين، ثم أضف أصناف المخزون.",
    "Create first storage": "أنشئ أول مكان تخزين", "Add first item": "أضف أول صنف", "Add first item →": "أضف أول صنف ←",
    // Auth
    "Sign In": "تسجيل الدخول", "Sign in": "تسجيل الدخول", "Welcome back": "مرحباً بعودتك", "Sign in to your workspace": "سجّل الدخول إلى مساحة عملك",
    "Create account": "إنشاء حساب", "Create Account": "إنشاء حساب", "Register with your company join code": "سجّل باستخدام رمز انضمام شركتك",
    "Full Name": "الاسم الكامل", "Email": "البريد الإلكتروني", "Email Address": "البريد الإلكتروني", "Password": "كلمة المرور",
    "Confirm Password": "تأكيد كلمة المرور", "Company Join Code": "رمز انضمام الشركة", "Ask your company manager for this code": "اطلب هذا الرمز من مدير شركتك",
    "Don't have an account?": "ليس لديك حساب؟", "Already have an account?": "لديك حساب بالفعل؟", "Forgot password?": "نسيت كلمة المرور؟",
    "Signing in...": "جارٍ تسجيل الدخول...", "Signing in…": "جارٍ تسجيل الدخول…", "Creating account...": "جارٍ إنشاء الحساب...", "Creating account…": "جارٍ إنشاء الحساب…",
    "Min. 8 characters": "8 أحرف على الأقل", "Re-enter password": "أعد إدخال كلمة المرور", "Enter your company code": "أدخل رمز شركتك",
    "Your display name": "اسمك الظاهر", "e.g. Ahmed Al-Zahrani": "مثال: أحمد الزهراني",
    "Invalid company code. Check with your manager.": "رمز الشركة غير صحيح. راجع مديرك.",
    "Invalid company code. Please check and try again.": "رمز الشركة غير صحيح. تحقق وحاول مرة أخرى.",
    "Invalid email or password.": "البريد الإلكتروني أو كلمة المرور غير صحيحة.", "Incorrect password": "كلمة المرور غير صحيحة",
    "This email is already registered.": "هذا البريد مسجّل مسبقاً.", "Password is too weak.": "كلمة المرور ضعيفة.",
    "Too many attempts. Try again later.": "محاولات كثيرة. حاول لاحقاً.", "Network error. Check your connection.": "خطأ في الشبكة. تحقق من اتصالك.",
    "Network error.": "خطأ في الشبكة.", "Network error — check connection": "خطأ في الشبكة — تحقق من الاتصال",
    "Network error. Please check your connection.": "خطأ في الشبكة. تحقق من اتصالك.", "Account not found. Please register.": "الحساب غير موجود. يرجى التسجيل.",
    "Account disabled.": "الحساب معطّل.", "Your account has been disabled. Contact your manager.": "تم تعطيل حسابك. تواصل مع مديرك.",
    "This company account has been disabled.": "تم تعطيل حساب هذه الشركة.", "Sign-in failed. Please try again.": "فشل تسجيل الدخول. حاول مرة أخرى.",
    "Email is required": "البريد الإلكتروني مطلوب", "Enter a valid email address": "أدخل بريداً إلكترونياً صحيحاً", "Invalid email": "بريد غير صالح",
    "Invalid email address.": "بريد إلكتروني غير صالح.", "Password is required": "كلمة المرور مطلوبة", "Password must be at least 8 characters": "كلمة المرور 8 أحرف على الأقل",
    "Passwords don't match": "كلمتا المرور غير متطابقتين", "Full name is required": "الاسم الكامل مطلوب", "Company join code is required": "رمز الانضمام مطلوب",
    "Join code must be 8 characters": "رمز الانضمام يجب أن يكون 8 خانات", "Name must be at least 2 characters": "الاسم حرفان على الأقل",
    "Your session has expired. Please sign in again.": "انتهت جلستك. سجّل الدخول مجدداً.", "You were signed out due to inactivity.": "تم تسجيل خروجك بسبب عدم النشاط.",
    "Session expired": "انتهت الجلسة", "Session ended": "انتهت الجلسة", "Signed in": "تم تسجيل الدخول", "Signed out": "تم تسجيل الخروج", "Sign out failed": "فشل تسجيل الخروج",
    // Common
    "Save": "حفظ", "Save Changes": "حفظ التغييرات", "Saving…": "جارٍ الحفظ…", "Cancel": "إلغاء", "Delete": "حذف", "Edit": "تعديل", "Archive": "أرشفة",
    "Restore": "استعادة", "Create": "إنشاء", "Add": "إضافة", "Search": "بحث", "Filter": "تصفية", "Export": "تصدير", "Import": "استيراد",
    "Loading...": "جارٍ التحميل...", "Confirm": "تأكيد", "Back": "رجوع", "Next": "التالي", "Close": "إغلاق", "View": "عرض", "Actions": "الإجراءات",
    "Action": "الإجراء", "Status": "الحالة", "Active": "نشط", "Archived": "مؤرشف", "Disabled": "معطّل", "Inactive": "غير نشط", "Created": "تاريخ الإنشاء",
    "Updated": "آخر تحديث", "Created By": "أنشأه", "Notes": "ملاحظات", "Note": "ملاحظة", "Optional": "اختياري", "Required": "مطلوب", "All": "الكل",
    "None": "لا يوجد", "None yet": "لا يوجد بعد", "Unknown": "غير معروف", "Copy": "نسخ", "Copied!": "تم النسخ!", "Copy to clipboard": "نسخ",
    "Continue": "متابعة", "Change": "تغيير", "Share": "مشاركة", "Dismiss": "إخفاء", "Success": "تم بنجاح", "Error": "خطأ", "Failed": "فشلت العملية",
    "No data": "لا توجد بيانات", "No data found": "لا توجد بيانات", "No records found": "لا توجد سجلات", "No results": "لا توجد نتائج", "No details": "لا توجد تفاصيل",
    "Something went wrong": "حدث خطأ ما", "Something went wrong. Please try again.": "حدث خطأ. حاول مرة أخرى.", "An error occurred. Please try again.": "حدث خطأ. حاول مرة أخرى.",
    "Reload Page": "إعادة تحميل الصفحة", "Reload page": "إعادة تحميل الصفحة", "Page not found": "الصفحة غير موجودة",
    "The page you're looking for doesn't exist.": "الصفحة التي تبحث عنها غير موجودة.", "Back to Dashboard": "العودة للرئيسية",
    "Permission denied — check Firestore rules": "تم رفض الصلاحية — راجع قواعد Firestore", "You don't have permission to perform this action.": "ليس لديك صلاحية لتنفيذ هذا الإجراء.",
    "Date": "التاريخ", "Type": "النوع", "Code": "الرمز", "Name": "الاسم", "Location": "الموقع", "Company": "الشركة", "Department": "القسم",
    "Department *": "القسم *", "Owner": "المالك", "Project": "المشروع", "Project *": "المشروع *", "Projects": "المشاريع", "Quantity": "الكمية",
    "Quantity *": "الكمية *", "Unit": "الوحدة", "Unit *": "الوحدة *", "Model": "الموديل", "Serial Number": "الرقم التسلسلي", "Summary": "الملخص",
    "Overview": "نظرة عامة", "Timeline": "الخط الزمني", "Remaining": "المتبقي", "Before": "قبل", "After": "بعد", "Reason": "السبب", "Destination": "الوجهة",
    "Signature": "التوقيع", "Low": "منخفض", "Expired": "منتهي", "Expiry": "الانتهاء", "Expiry Date": "تاريخ الانتهاء", "Soon": "قريباً", "Other": "أخرى", "General": "عام",
    // Storages
    "New Storage": "مكان تخزين جديد", "Create Storage": "إنشاء مكان تخزين", "Edit Storage": "تعديل مكان التخزين", "Storage Name": "اسم مكان التخزين",
    "Storage Name *": "اسم مكان التخزين *", "Storage Type": "نوع التخزين", "Storage Type *": "نوع التخزين *", "Warehouse Code": "رمز المستودع",
    "Manager Name": "اسم المسؤول", "Location *": "الموقع *", "Code *": "الرمز *", "No storages": "لا توجد أماكن تخزين", "No storages yet": "لا توجد أماكن تخزين بعد",
    "No archived storages": "لا توجد أماكن مؤرشفة", "All Storages": "كل أماكن التخزين", "All Warehouses": "كل المستودعات", "Select warehouse…": "اختر مكان التخزين…",
    "Select a warehouse": "اختر مكان التخزين", "Warehouse *": "مكان التخزين *", "Archive Storage?": "أرشفة مكان التخزين؟",
    "Are you sure you want to archive this warehouse?": "هل أنت متأكد من أرشفة مكان التخزين هذا؟", "Are you sure you want to restore this warehouse?": "هل تريد استعادة مكان التخزين هذا؟",
    "Storage created": "تم إنشاء مكان التخزين", "Storage updated": "تم تحديث مكان التخزين", "Storage archived": "تمت أرشفة مكان التخزين",
    "Storage restored": "تمت استعادة مكان التخزين", "Warehouse created": "تم إنشاء المستودع", "Deleted permanently": "تم الحذف نهائياً",
    "Delete Permanently": "حذف نهائي", "Delete Permanently?": "حذف نهائي؟", "Permanent Delete": "حذف نهائي", "Failed to load storages": "تعذّر تحميل أماكن التخزين",
    "Code already used in this company": "الرمز مستخدم في هذه الشركة", "Code must be unique within the company": "يجب أن يكون الرمز فريداً داخل الشركة",
    "Main Storage": "المخزن الرئيسي", "Cold Storage": "تخزين مبرّد", "Hazardous": "مواد خطرة", "Archived Items": "أصناف مؤرشفة",
    // Items
    "Add Item": "إضافة صنف", "Add New Item": "إضافة صنف جديد", "New Item": "صنف جديد", "Edit Item": "تعديل الصنف", "Add Items": "إضافة أصناف",
    "Item": "الصنف", "Item Name": "اسم الصنف", "Item Name *": "اسم الصنف *", "Item Code": "رمز الصنف", "Internal ID": "المعرّف الداخلي",
    "Stock Number": "رقم المخزون", "Min Threshold": "الحد الأدنى", "Min. Threshold": "الحد الأدنى", "Owner / Responsible": "المالك / المسؤول",
    "Entry Date": "تاريخ الإدخال", "Item Timeline": "سجل الصنف", "All Items": "كل الأصناف", "All Projects": "كل المشاريع", "No items yet": "لا توجد أصناف بعد",
    "No inventory yet": "لا يوجد مخزون بعد", "No archived items": "لا توجد أصناف مؤرشفة", "Item added": "تمت إضافة الصنف", "Item updated": "تم تحديث الصنف",
    "Item archived": "تمت أرشفة الصنف", "Item restored": "تمت استعادة الصنف", "Item returned": "تم إرجاع الصنف", "Item withdrawn": "تم صرف الصنف",
    "Archive Item?": "أرشفة الصنف؟", "Failed to load items": "تعذّر تحميل الأصناف", "Failed to save item": "تعذّر حفظ الصنف", "Item not found": "الصنف غير موجود",
    "Quantity changed": "تم تغيير الكمية", "Current Qty": "الكمية الحالية", "Qty Before": "الكمية قبل", "Qty After": "الكمية بعد", "Qty Out": "الكمية المصروفة",
    "Cannot be negative": "لا يمكن أن تكون سالبة", "Quantity cannot be negative": "الكمية لا يمكن أن تكون سالبة", "At least 1": "1 على الأقل",
    "Insufficient stock": "المخزون غير كافٍ", "Insufficient stock available": "الكمية المتوفرة غير كافية", "Assets Owner": "مالك الأصول", "Assets Owner *": "مالك الأصول *",
    "Assets Tag": "رقم الأصل", "Install Location": "موقع التركيب", "Model Category": "فئة الموديل", "SAP Code": "رمز SAP", "PO Number": "رقم أمر الشراء",
    "P/O Number": "رقم أمر الشراء", "DN Number": "رقم سند التسليم", "D/N Number": "رقم سند التسليم", "Ticket No.": "رقم التذكرة", "Last Inventory": "آخر جرد",
    "Items per page": "عدد الأصناف بالصفحة", "Page": "صفحة", "Movement History": "سجل الحركات", "Movements": "الحركات", "All Movements": "كل الحركات",
    "No movements yet": "لا توجد حركات بعد", "No history yet": "لا يوجد سجل بعد", "Items & Inventory": "الأصناف والمخزون", "Items by Warehouse": "الأصناف حسب المستودع",
    "Add to release": "إضافة لسند الصرف", "Add to Release": "إضافة لسند الصرف", "Remove from release": "إزالة من سند الصرف",
    "A release can only include items from one storage": "سند الصرف يجب أن يحتوي أصنافاً من مكان تخزين واحد فقط",
    // Withdrawals & releases
    "Withdraw": "صرف", "Withdraw Item": "صرف صنف", "Withdrawal": "الصرف", "Withdrawals": "عمليات الصرف", "Withdrawal Details": "تفاصيل الصرف",
    "Withdrawal Reason": "سبب الصرف", "Withdrawal recorded": "تم تسجيل الصرف", "Confirm Withdrawal": "تأكيد الصرف", "Quantity to Withdraw": "الكمية المطلوب صرفها",
    "Requester": "مقدّم الطلب", "Requester Name": "اسم مقدّم الطلب", "Destination / Location": "الوجهة / الموقع", "Approved By": "اعتمده", "Performed By": "نفّذه",
    "No withdrawals yet": "لا توجد عمليات صرف بعد", "Units Withdrawn": "الوحدات المصروفة", "Release": "سند صرف", "Releases": "سندات الصرف",
    "Material Release": "سند صرف مواد", "Material Release Form": "نموذج صرف مواد", "Release Records": "سجل سندات الصرف", "Release created": "تم إنشاء سند الصرف",
    "Release failed": "فشل إنشاء سند الصرف", "Cancel Release": "إلغاء السند", "Cancel Release?": "إلغاء سند الصرف؟", "Keep Release": "إبقاء السند",
    "Already cancelled": "ملغى مسبقاً", "Failed to cancel release": "تعذّر إلغاء السند", "Release not found": "السند غير موجود", "Reason for release…": "سبب الصرف…",
    "No releases yet — add items to cart then release": "لا توجد سندات بعد — أضف أصنافاً للسلة ثم أصدر السند", "Tap to review": "اضغط للمراجعة",
    "Request Type": "نوع الطلب", "Received by:": "استلمه:", "Requested by:": "طلبه:", "🖨 Print A4 Landscape": "🖨 طباعة A4 أفقي",
    "Purchase / Transfer": "شراء / نقل", "Site installation": "تركيب في الموقع", "Initial stock entry": "إدخال مخزون أولي", "Manual quantity update": "تحديث يدوي للكمية",
    // Reports
    "Full Inventory Report": "تقرير المخزون الكامل", "Low Stock Report": "تقرير المخزون المنخفض", "Out of Stock Report": "تقرير الأصناف النافدة",
    "Low Stock CSV": "المخزون المنخفض CSV", "Withdrawals CSV": "عمليات الصرف CSV", "Analytics & data export": "التحليلات وتصدير البيانات",
    "By Project": "حسب المشروع", "Failed to load reports": "تعذّر تحميل التقارير", "Excel": "إكسل", "Excel exported": "تم تصدير ملف إكسل",
    "Excel imported": "تم استيراد ملف إكسل", "Exported": "تم التصدير", "Imported": "تم الاستيراد", "Import failed": "فشل الاستيراد",
    "Importing… please wait": "جارٍ الاستيراد… يرجى الانتظار", "Import Complete": "اكتمل الاستيراد", "Failed to read file": "تعذّرت قراءة الملف",
    "Merge": "دمج", "Replace All": "استبدال الكل", "Add new, update existing (by Stock Number), keep the rest": "إضافة الجديد وتحديث الموجود (حسب رقم المخزون) مع إبقاء الباقي",
    "Delete all existing items and import the new ones": "حذف كل الأصناف الحالية واستيراد الجديدة", "⚠ Choose how to handle existing items in this storage.": "⚠ اختر طريقة التعامل مع الأصناف الموجودة في هذا المكان.",
    "Popup blocked. Allow popups and try again.": "تم حظر النافذة المنبثقة. اسمح بها وحاول مجدداً.", "Popup blocked - allow popups": "تم حظر النافذة المنبثقة",
    // Users
    "Role": "الدور", "Role / Type": "الدور / النوع", "Administrator": "مدير", "Manager": "مدير", "Data Entry": "إدخال بيانات", "Viewer": "مشاهد",
    "Super Admin": "المشرف العام", "Edit User": "تعديل المستخدم", "User updated": "تم تحديث المستخدم", "User created": "تم إنشاء المستخدم",
    "User activated": "تم تفعيل المستخدم", "User deactivated": "تم تعطيل المستخدم", "Role changed": "تم تغيير الدور", "No users found": "لا يوجد مستخدمون",
    "Failed to load users": "تعذّر تحميل المستخدمين", "Join Code": "رمز الانضمام", "Joined": "تاريخ الانضمام", "Display Name": "الاسم الظاهر",
    "Assigned Warehouses": "أماكن التخزين المخصصة", "Share with new employees to let them register": "شاركه مع الموظفين الجدد ليتمكنوا من التسجيل",
    "User": "المستخدم", "Entity": "العنصر", "Previous Value": "القيمة السابقة", "New Value": "القيمة الجديدة", "Timestamp": "الوقت",
    "No activity logs found": "لا يوجد نشاط", "No logs found": "لا توجد سجلات", "No activity yet": "لا يوجد نشاط بعد", "Failed to load logs": "تعذّر تحميل السجل",
    // Settings
    "Customize your STORA experience": "خصّص تجربتك في STORA", "Profile": "الملف الشخصي", "Appearance": "المظهر", "Theme": "السمة", "Language": "اللغة",
    "Dark": "داكن", "Light": "فاتح", "System": "النظام", "English": "English", "Animated Background": "خلفية متحركة", "Background Animation": "حركة الخلفية",
    "Decorative moving effect": "تأثير متحرك للزينة", "Squares": "مربعات", "Particles": "جزيئات", "Waves": "موجات", "Grid": "شبكة",
    "Edit name": "تعديل الاسم", "Name updated": "تم تحديث الاسم", "Failed to update name": "تعذّر تحديث الاسم", "Language changed": "تم تغيير اللغة",
    "Release Form — Signatories": "نموذج الصرف — المعتمدون", "These names appear in the printed material release form.": "تظهر هذه الأسماء في نموذج صرف المواد المطبوع.",
    "Save Signatories": "حفظ المعتمدين", "Signatories saved": "تم حفظ المعتمدين", "Position / Title": "المنصب / المسمى", "Failed to save": "تعذّر الحفظ",
    "Data Management": "إدارة البيانات", "Full Backup (.xlsx)": "نسخة احتياطية كاملة (.xlsx)", "Backup exported": "تم تصدير النسخة الاحتياطية",
    "Reset Data": "مسح البيانات", "Reset Data…": "مسح البيانات…", "Data Reset": "مسح البيانات", "Reset Complete": "اكتمل المسح", "Reset failed": "فشل المسح",
    "Permanently delete items, movements, releases or all data": "حذف الأصناف أو الحركات أو السندات أو كل البيانات نهائياً", "Select what to delete:": "اختر ما تريد حذفه:",
    "Administrator only — irreversible": "للمدير فقط — لا يمكن التراجع", "⚠ This cannot be undone": "⚠ لا يمكن التراجع عن هذا", "⚠ Reset Everything": "⚠ مسح كل شيء",
    "Administrator Password": "كلمة مرور المدير", "Enter reset password": "أدخل كلمة مرور المسح", "Delete Now": "احذف الآن", "Data deleted successfully.": "تم حذف البيانات بنجاح.",
    "Delete all inventory items": "حذف كل أصناف المخزون", "Delete all storage locations": "حذف كل أماكن التخزين", "Delete all withdrawal & movement records": "حذف كل سجلات الصرف والحركات",
    "Delete all material release records": "حذف كل سندات الصرف", "Delete all audit logs": "حذف كل سجلات النشاط", "Delete all users except your account": "حذف كل المستخدمين عدا حسابك",
    "Delete ALL data + users (keeps your account)": "حذف كل البيانات والمستخدمين (مع إبقاء حسابك)", "Deleting users…": "جارٍ حذف المستخدمين…",
    "Developer": "المطوّر", "Developer Information": "معلومات المطوّر", "Mark all as read": "تعليم الكل كمقروء", "No notifications": "لا توجد إشعارات", "System Message": "رسالة النظام",
    "Application failed to load": "تعذّر تحميل التطبيق", "Offline": "غير متصل",
    // Companies (v2.0)
    "Manage companies and their join codes": "إدارة الشركات ورموز الانضمام", "+ New Company": "+ شركة جديدة", "New Company": "شركة جديدة",
    "Edit Company": "تعديل الشركة", "Company Name": "اسم الشركة", "Generate": "توليد", "Search companies…": "ابحث عن شركة…", "Total Users": "إجمالي المستخدمين",
    "Awaiting permissions": "بانتظار الصلاحيات", "Managers": "المدراء", "Built-in": "أساسية", "Disable": "تعطيل", "Enable": "تفعيل",
    "Company created": "تم إنشاء الشركة", "Company updated": "تم تحديث الشركة", "Company enabled": "تم تفعيل الشركة", "Company disabled": "تم تعطيل الشركة",
    "Code already used by another company": "الرمز مستخدم لشركة أخرى", "Failed to save — check Firestore rules": "تعذّر الحفظ — راجع قواعد Firestore",
    "Active (new users can join)": "نشطة (يمكن للمستخدمين الجدد الانضمام)", "e.g. Jeddah Airports": "مثال: مطارات جدة",
    "8 letters/numbers. Changing it disables the old code; existing users are not affected.": "8 حروف/أرقام. تغييره يعطّل الرمز القديم ولا يؤثر على المستخدمين الحاليين.",
    "Jeddah Airports": "مطارات جدة", "Sort:": "ترتيب:", "Qty": "الكمية", "All good": "كل شيء جيد", "Search...": "بحث...", "Search…": "بحث…",
    "Newest": "الأحدث", "Oldest": "الأقدم", "Name A-Z": "الاسم أ-ي", "Released": "مصروف", "Cancelled": "ملغى", "Returned": "مُرجع", "Add Stock": "إضافة كمية", "New — needs permissions": "جديد — يحتاج صلاحيات",
    "Tap the edit icon next to each one to choose a role and storages.": "اضغط أيقونة التعديل بجانب كل مستخدم لتحديد دوره وأماكن التخزين.",
    "Your account is ready": "حسابك جاهز", "Menu": "القائمة",
    "Your manager will assign your role and storages shortly. You will see your data here once that is done.": "سيحدد مديرك دورك وأماكن التخزين قريباً، وستظهر بياناتك هنا بعد ذلك.",
    "(you)": "(أنت)", "Print": "طباعة", "Loading…": "جارٍ التحميل…", "members": "عضو", "entries": "سجل", "Auth": "الدخول",
    "Left to Right": "من اليسار لليمين", "Right to Left": "من اليمين لليسار", "All good ✓": "كل شيء جيد ✓", "John Smith": "مثال: محمد أحمد", "your@email.com": "your@email.com"
  };
  var PATTERNS = [
    [/^(Good morning|Good afternoon|Good evening),\s*(.*)$/, function (m) { return (AR[m[1]] || m[1]) + "، " + m[2]; }],
    [/^(\d+)\s+(items?|Items?)$/, function (m) { return m[1] + " صنف"; }],
    [/^(\d+)\s+(storages?|Storages?|locations?)$/, function (m) { return m[1] + " مكان تخزين"; }],
    [/^(\d+)\s+(users?|members?)$/i, function (m) { return m[1] + " مستخدم"; }],
    [/^active\s+(\d+)$/i, function (m) { return m[1] + " نشط"; }],
    [/^(\d+)\s+active$/i, function (m) { return m[1] + " نشط"; }],
    [/^(\d+) new user\(s\) waiting for permissions$/, function (m) { return m[1] === "1" ? "مستخدم جديد بانتظار الصلاحيات" : m[1] + " مستخدمين جدد بانتظار الصلاحيات"; }],
    [/^Available:\s*(.*)$/, function (m) { return "المتوفر: " + m[1]; }],
    [/^Reason:\s*(.*)$/, function (m) { return "السبب: " + m[1]; }],
    [/^Destination:\s*(.*)$/, function (m) { return "الوجهة: " + m[1]; }],
    [/^Requester:\s*(.*)$/, function (m) { return "مقدّم الطلب: " + m[1]; }]
  ];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, CODE: 1, PRE: 1, SELECT: 0 };
  var orig = new WeakMap();      // text node -> original English
  var origAttr = new WeakMap();  // element -> {attr: original}
  var ATTRS = ["placeholder", "title", "aria-label"];

  function isAr() {
    try { return (localStorage.getItem("wms_language") || document.documentElement.lang || "").indexOf("ar") === 0; }
    catch (e) { return document.documentElement.lang === "ar"; }
  }
  function tr(text) {
    var t = text.trim();
    if (!t || t.length > 140) return null;
    if (Object.prototype.hasOwnProperty.call(AR, t)) return AR[t];
    var cap = t.charAt(0).toUpperCase() + t.slice(1);
    if (cap !== t && Object.prototype.hasOwnProperty.call(AR, cap)) return AR[cap];
    for (var i = 0; i < PATTERNS.length; i++) { var m = t.match(PATTERNS[i][0]); if (m) return PATTERNS[i][1](m); }
    return null;
  }
  function skipped(el) {
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      if (SKIP[n.tagName] || n.getAttribute && (n.getAttribute("translate") === "no" || n.classList.contains("s-mono"))) return true;
    }
    return false;
  }
  function doText(node, ar) {
    var cur = node.nodeValue;
    if (ar) {
      var src = orig.has(node) ? orig.get(node) : null;
      // React may have replaced the text: re-capture if current text is not our translation
      if (src === null || (cur !== src && tr(src) !== cur.trim())) { src = cur; }
      var out = tr(src);
      if (out == null) { orig.delete(node); return; }
      orig.set(node, src);
      var lead = src.match(/^\s*/)[0], trail = src.match(/\s*$/)[0];
      var val = lead + out + trail;
      if (cur !== val) node.nodeValue = val;
    } else if (orig.has(node)) {
      var o = orig.get(node); orig.delete(node);
      if (tr(o) === cur.trim()) node.nodeValue = o;
    }
  }
  function doAttrs(el, ar) {
    var saved = origAttr.get(el) || {};
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var cur = el.getAttribute(a);
      if (ar) {
        var src = saved[a] != null && tr(saved[a]) === cur ? saved[a] : cur;
        var out = tr(src);
        if (out != null) { saved[a] = src; if (cur !== out) el.setAttribute(a, out); }
      } else if (saved[a] != null) { if (tr(saved[a]) === cur) el.setAttribute(a, saved[a]); delete saved[a]; }
    });
    origAttr.set(el, saved);
  }
  function walk(root, ar) {
    if (!root) return;
    if (root.nodeType === 3) { if (root.parentElement && !skipped(root.parentElement)) doText(root, ar); return; }
    if (root.nodeType !== 1 || SKIP[root.tagName] && root.tagName !== "INPUT" && root.tagName !== "TEXTAREA") return;
    if (skipped(root) && root.tagName !== "INPUT" && root.tagName !== "TEXTAREA") return;
    doAttrs(root, ar);
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) { if (!skipped(n.parentElement)) doText(n, ar); }
      else { doAttrs(n, ar); }
    }
  }
  var pending = false, lastAr = null;
  function run(full) {
    var ar = isAr();
    if (full || ar !== lastAr) { lastAr = ar; document.documentElement.classList.toggle("stora-ar", ar); walk(document.body, ar); }
  }
  var obs = new MutationObserver(function (muts) {
    var ar = isAr();
    if (ar !== lastAr) { run(true); return; }
    if (!ar) return;
    obs.disconnect();
    muts.forEach(function (m) {
      if (m.type === "characterData") walk(m.target, true);
      else if (m.type === "attributes") { if (m.target.nodeType === 1) doAttrs(m.target, true); }
      else m.addedNodes.forEach(function (n) { walk(n, true); });
    });
    connect();
  });
  function connect() {
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }
  function start() { run(true); connect(); }

  // Offline indicator
  function offlinePill() {
    var el = document.getElementById("stora-offline");
    if (!el) { el = document.createElement("div"); el.id = "stora-offline"; el.setAttribute("translate", "no"); document.body.appendChild(el); }
    el.textContent = isAr() ? "غير متصل — تعمل الآن من البيانات المحفوظة على جهازك" : "Offline — working from data saved on this device";
    el.classList.toggle("show", !navigator.onLine);
  }
  function closeNav() { document.documentElement.classList.remove("stora-nav-open"); }
  window.addEventListener("hashchange", closeNav);
  window.addEventListener("popstate", closeNav);
  document.addEventListener("click", function (e) { var a = e.target && e.target.closest && e.target.closest(".stora-aside a, .stora-aside button"); if (a) setTimeout(closeNav, 60); }, true);
  window.addEventListener("online", offlinePill);
  window.addEventListener("offline", offlinePill);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { start(); offlinePill(); });
  else { start(); offlinePill(); }

  // Service worker (app shell offline cache)
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("/Stora/v2/sw.js", { scope: "/Stora/v2/" }).catch(function () {}); });
  }
  window.__storaI18n = { tr: tr, dict: AR };
})();
