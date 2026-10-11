# دليل التوثيق الشامل والمواصفات الفنية لتطبيق الهاتف (Flutter Replication Guide)
## منصة طفرة التعليمية - Tafra Learning Platform

> **الغرض من هذا الملف:** توثيق كل تفاصيل منصة "طفرة التعليمية" (منطق العمليات، الهوية البصرية، الألوان، الأنيميشن، الهيكلية، الواجهات، وجميع الـ REST APIs) لبناء وتطبيق هاتف باستخدام **Flutter** ليكون مطابساً لمنصة الويب 100%.

---

## 1. الهيكلية العامة وإعدادات الاتصال (Backend Architecture & Base Setup)

### 1.1 إعدادات الاتصال والـ Base URL
* **Base URL للتطوير المحلي (Local Development):** `http://<YOUR_LOCAL_IP>:5000/api` (استبدل IP الجهاز بدلاً من localhost لعمل Flutter Emulator / Real Device).
* **Base URL للإنتاج (Production):** `https://tafra-learning.domain.com/api`
* **نوع التوثيق (Authentication Header):**
  يجب إرسال رمز JWT Bearer Token مع كافة الطلبات المحمية:
  ```http
  Authorization: Bearer <YOUR_JWT_TOKEN>
  Content-Type: application/json
  ```

---

## 2. الهوية البصرية ونظام التصميم (Design System, Colors & Motion)

### 2.1 لوحة الألوان الرسمية (Color Palette Tokens)
تعتمد منصة طفرة على هوية **Editorial Learning Atelier** التي تجمع بين البساطة والأناقة البصرية مع دعم الوضع الليلي (Dark Mode):

| الاسم في الويب | القيمة (Hex) | الاستخدام والتطبيق في Flutter |
| :--- | :--- | :--- |
| `primary` | `#F36A21` | اللون البرتقالي الأساسي (الأزرار الرئيسية، الهيلايت، الأيقونات النشطة) |
| `primary-hover` | `#135FAB` / `#D95614` | درجة التفاعل والضغط للأزرار |
| `background` (Light) | `#FBFAF7` | خلفية التطبيق الدافئة الكلاسيكية (Warm Cream White) |
| `background` (Dark) | `#151719` | خلفية التطبيق بالوضع الليلي |
| `card` (Light) | `#FFFEFA` | خلفية البطاقات والقوائم والكروت |
| `card` (Dark) | `#202427` | خلفية الكروت في الوضع الليلي |
| `foreground` (Light) | `#181615` | لون النصوص الأساسي والعناوين |
| `foreground` (Dark) | `#F7EFE7` | لون النصوص في الوضع الليلي |
| `border` (Light) | `#EBE3DB` | لقطاع الحدود والفاصل بين العناصر |
| `border` (Dark) | `#384047` | حدود العناصر في الوضع الليلي |
| `ink-muted` | `#7B6E65` | النصوص الثانوية والملاحظات الهامشية |
| `mint` (Success) | `#10B981` | حالات النجاح، إكمال الدروس، والشهادات |
| `amber` (Warning) | `#E79A23` | شارات الانتظار والمراجعة |
| `coral` (Danger) | `#DF5B3D` / `#EF6B5B` | التنبيهات والأخطاء وحالات الرفض |
| `paper` | `#FFFAF4` | بطاقات التفاصيل والأوراق التفاعلية |

### 2.2 الخطوط ونظام الطباعة (Typography)
* **الخط العربي الأساسي:** `Changa` أو `Noto Sans Arabic` (متوفر على Google Fonts).
* **الخط الإنجليزي والأرقام:** `DM Sans` (للأرقام والنسب المئوية والتواريخ).
* **اتجاه الواجهة (Directionality):** `RTL` (من اليمين إلى اليسار) بالكامل بشكل افتراضي.

### 2.3 الحركة والأنيميشن (Animations & Transitions)
* **منحنى الحركة (Easing Curve):** `Cubic(0.23, 1.0, 0.32, 1.0)` (ينتج عنه حركة ناعمة جداً).
* **تأثير ظهور العناصر (Rise Animation):** تحريك من الأسفل بقيمة `16dp` مع تغيير الفافية (Fade-in) خلال `450ms`.
* **تأثير النقر للأزرار (Active Scale):** عند الضغط على الأزرار يقل حجم الزر قليلاً `transform: scale(0.98)` لتوفير إحساس باللمس اللمسي (Haptic Feedback).

---

## 3. تكتيكات التحميل الاحترافية (Skeletonizer & Loading Strategy)

بدلاً من الشاشات الفارغة أو استخدام بيانات وهمية مؤقتة، تعتمد الواجهة على حزمة **`skeletonizer`** في Flutter أثناء تنفيذ طلبات الـ API:

### 3.1 قواعد تطبيق Skeletonizer في Flutter
1. عند بدء طلب الـ API لجلب البيانات (مثل جلب الكورسات أو الإحصائيات)، يتم ضبط الحالة `isLoading = true`.
2. يتم تلفيف العناصر الـ UI المعنية بأداة `Skeletonizer(enabled: isLoading, child: ...)` مع تزويدها ببيانات هيكلية نموذجية.
3. **Skeleton الكورسات:** يعرض صورة مستطيلة بحواف دائرية `17dp` ومساحة للنص وشريط تقدم وهمي.
4. **Skeleton الإحصائيات (Stat Cards):** يعرض كروت ذات حجم `108dp` ارتفاع مع دائرية أيقونة `12dp`.
5. **Skeleton الجدول والدروس:** يعرض 4 إلى 5 صفوف وهمية بنظام شريط الحشو الرمادي المموج.

---

## 4. منطق التقاط وتحميل صورة الإيصال (Camera & Gallery Receipt Picker)

عند قيام الطالب بالاشتراك في كورس مدفوع وتحويل المبلغ (عبر فودافون كاش أو البنك)، يتعين عليه تقديم **إيصال التحويل**:

### 4.1 خطوات واجهة التقاط الصورة في Flutter:
1. عند الضغط على مربع رفع الإيصال (`transfer-upload` / `Upload Receipt Area`):
2. يتم فتح نافذة خيارات خفيفة من الأسفل (`ModalBottomSheet` أو `Dialog` مخصص) تحتوي على الخيارين التاليين:
   * **فتح الكاميرا والتقاط صورة فوراً:** `ImagePicker().pickImage(source: ImageSource.camera)`
   * **اختر من معرض الصور:** `ImagePicker().pickImage(source: ImageSource.gallery)`
3. **معاينة الصورة (Image Preview):**
   * بمجرد اختيار الصورة أو التقاطها، تظهر الصورة في كادر معاينة مخصص بنفس الواجهة مع زر **حذف/إعادة التقاط** (`IconButton(icon: Icons.delete)`).
4. **الرفع الـ Form Data / Base64:**
   * يتم رفع الصورة عبر `Multipart/form-data` كـ file إلى سيرفر الـ API في endpoint دفع الكورس `POST /api/enrollments/manual`.

---

## 5. واجهات ووظائف الطالب (Student Experience Guide)

### 5.1 الشاشة الرئيسية للطالب (Student Dashboard)
* **Hero Banner:** كارت ترحيبي عالي العرض بلون أزرق/برتقالي يعرض اسم الطالب ونسبة الإنجاز الكلية وزر سريع لمتابعة آخر درس.
* **بطاقات الإحصائيات (Stat Cards Grid - 4 Column/Grid):**
  1. الكورسات المسجلة (Enrolled Courses Count).
  2. نسبة الإكمال العامة (Overall Progress %).
  3. الساعات المكتملة (Hours Watched).
  4. الشهادات المكتسبة (Certificates Earned).
* **شبكة الكورسات المتاحة والمقترحة (Course Grid):**
  * عرض كروت الكورسات بحواف `17dp` وظل خفيف (`box-shadow: 0 8px 18px rgba(0,0,0,0.05)`).
  * كل كارت يحتوي على: صورة الكورس، شارة الفئة/المستوى، اسم المحاضر، العنوان، وسعر الكورس أو شريط التقدم إن كان الطالب مشتركاً بالفعل.

### 5.2 تفاصيل الكورس (Course Detail Screen)
* **الغلاف (Course Cover):** صورة الكورس الرئيسية مع طبقة تدرج لوني دافئ (Gradient).
* **معلومات الكورس:** العنوان الكامل، الوصف التفصيلي، عدد المحاضرات، المدة الزمنية الكلية، اسم المدرس مع الصورة الشخصية.
* **المنهج والدروس (Syllabus List):** قائمة المحاضرات مقسمة إلى أقسام (Sections) أو قائمة دروس مباشرة مع مدة كل درس وأيقونة القفل للدروس المدفوعة.
* **زر الشراء / الاشتراك (Enroll / Buy Button):**
  * إذا كان الكورس مجانياً: زر انضمام فوري `POST /api/enrollments/free`.
  * إذا كان الكورس مدفوعاً: فتح نافذة/شاشة الدفع والتحويل المالي.

### 5.3 شاشة مشاهدة الدرس والتعلم (Lesson Viewer Screen)
* **مشغل الفيديو (Video Player Area):**
  * مشغل فيديو مخصص يستعرض الفيديو الخاص بالدرس.
  * أزرار التحكم بالسرعة (0.75x, 1x, 1.25x, 1.5x, 2x) وجودة البث.
* **متابعة الإنجاز والتقدم (Progress Tracking Logic):**
  * عند وصول مشغل الفيديو لنسبة 90% أو النقر على زر "إكمال الدرس": يتم استدعاء الـ API `POST /api/lessons/:id/progress` لإرسال `completed: true`.
  * يتم تحديث شريط progress الخاص بالكورس تلقائياً.
* **المرفقات والملاحظات (Lesson Materials & Attachments):**
  * تبويب خاص بتنزيل ملفات PDF وتلخيصات الدرس.
* **الاختبارات القصيرة (Lesson Quizzes & Assessments):**
  * عرض أسئلة الاختيار من متعدد (Multiple Choice Questions) مع اختيار الخيارات الفردية وإظهار النتيجة الفورية.

---

## 6. واجهات ووظائف المدرس (Teacher Experience Guide)

### 6.1 لوحة تحكم المدرس (Teacher Dashboard)
* **إحصائيات المدرس:** إجمالي عدد الطلاب المشتركين، إجمالي الإيرادات، عدد الكورسات المنشورة، ومتوسط تقييمات الكورسات.
* **قائمة الكورسات الخاصة بالمدرس:** بطاقات مخصصة تمكّن المدرس من الإضافة أو التعديل أو استعراض التحليلات.

### 6.2 إنشاء وإدارة الكورسات والدروس (Course Builder)
* **نموذج بيانات الكورس:** (العنوان، الوصف، الفئة، المستوى، السعر، صورة الكورس).
* **إضافة الدروس (Lesson Creator Form):**
  * عنوان الدرس، وصف قصير، رابط الفيديو (سواء كان رفع مباشر أو Vimeo/HLS)، المرفقات.
  * تحديد خيار "معاينة مجانية" (Free Preview) لتمكين الطلاب من مشاهدة الفيديو قبل الاشتراك.
* **منشئ الاختبارات (Quiz & Assessment Builder):**
  * إضافة أسئلة وتحديد الإجابات الصحيحة وتأيين الدرجات لكل سؤال.

### 6.3 رصد الدرجات ومتابعة تسليمات الطلاب (Gradebook & Assessment Review)
* قائمة بالطلاب الذين قدموا التقييمات والاختبارات، مع إمكانية إدخال/تعديل الدرجات ورصدها فوريًا واستدعاء API الـ Gradebook.

---

## 7. واجهات ووظائف الأدمن (Admin Experience Guide)

### 7.1 لوحة الأدمن العامة (Admin Dashboard)
* **مؤشرات النظام (System Metrics):** إجمالي الإيرادات، إجمالي طلبات الدفع المعلقة، عدد الطلاب الكلي، وعدد المدرسين.

### 7.2 إدارة طلبات الاشتراكات والدفع اليدوي (Manual Payment Approvals Flow)
تُعد هذه الوظيفة من أهم أجزاء المنصة:
1. **قائمة طلبات الدفع المعلقة (Pending Payment Receipts Table/List):**
   * تُعرض كل عملية دفع يدوي معلقة مع اسم الطالب، الكورس، المبلغ، رقم المحول، وتاريخ الطلب.
2. **معاينة صورة الإيصال (Receipt Viewer Modal):**
   * عند النقر على خيار "عرض الإيصال"، تفتح صورة إيصال التحويل المرفوعة بحجم مكبر مع إمكانية التكبير والتصغير (Zoom).
3. **قرار التفعيل أو الرفض:**
   * **زر القبول (Approve Payment):** عند الضغط عليه، يتم استدعاء API القبول `POST /api/admin/payments/:id/approve`. يتم فتح الكورس فوراً للطالب وإرسال إشعار له.
   * **زر الرفض (Reject Payment):** عند الضغط عليه، تظهر نافذة لإدخال "سبب الرفض" ثم استدعاء API الرفض `POST /api/admin/payments/:id/reject`.

### 7.3 إدارة طرق الدفع المتاحة (Payment Methods Config)
* تمكين الأدمن من إضافة/تعديل طرق التحويل (مثل رقم فودافون كاش، رقم الحساب البنكي IBAN، اسم المستقبل، وتعلية طرق الدفع وإيقافها).

---

## 8. دليل الـ REST API Endpoints التفصيلي (Comprehensive API Reference)

### 8.1 توثيق الحسابات والتوثيق (Auth Endpoints)

#### `POST /api/auth/register`
* **الوصف:** إنشاء حساب جديد (طالب أو مدرس).
* **Body Request:**
```json
{
  "name": "أحمد محمود",
  "email": "ahmed@example.com",
  "password": "password123",
  "role": "student" // or "teacher"
}
```
* **Response (201 Created):**
```json
{
  "user": {
    "id": 1,
    "name": "أحمد محمود",
    "email": "ahmed@example.com",
    "role": "student"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkXVCJ9..."
}
```

#### `POST /api/auth/login`
* **الوصف:** تسجيل الدخول والحصول على رمز التوثيق.
* **Body Request:**
```json
{
  "email": "ahmed@example.com",
  "password": "password123"
}
```
* **Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "name": "أحمد محمود",
    "email": "ahmed@example.com",
    "role": "student"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkXVCJ9..."
}
```

#### `GET /api/auth/me`
* **الوصف:** جلب بيانات المستخدم الحالي.
* **Headers:** `Authorization: Bearer <token>`
* **Response (200 OK):**
```json
{
  "id": 1,
  "name": "أحمد محمود",
  "email": "ahmed@example.com",
  "role": "student",
  "avatarUrl": "https://..."
}
```

---

### 8.2 الكورسات والمنهج (Courses & Syllabus Endpoints)

#### `GET /api/courses`
* **الوصف:** جلب جميع الكورسات المتاحة مع إمكانية التصفية (Query Filters).
* **Query Params:** `category`, `search`, `level`, `page`
* **Response (200 OK):**
```json
[
  {
    "id": 101,
    "title": "كورس تطوير تطبيق Flutter احترافي",
    "description": "تعلم بناء تطبيقات الجوال باستخدام Flutter و Dart من الصفر",
    "price": 450,
    "imageUrl": "https://...",
    "category": "Mobile Development",
    "instructor": {
      "id": 5,
      "name": "م. محمد علي",
      "avatarUrl": "https://..."
    },
    "totalLessons": 24,
    "durationHours": 18.5
  }
]
```

#### `GET /api/courses/:id`
* **الوصف:** جلب تفاصيل كورس معين مع قائمة الدروس والمنهج.
* **Response (200 OK):**
```json
{
  "id": 101,
  "title": "كورس تطوير تطبيق Flutter احترافي",
  "description": "تفاصيل الكورس الكاملة...",
  "price": 450,
  "imageUrl": "https://...",
  "isEnrolled": false,
  "lessons": [
    {
      "id": 501,
      "title": "مقدمة في أساسيات Dart",
      "duration": "12:45",
      "isFreePreview": true,
      "isCompleted": false
    },
    {
      "id": 502,
      "title": "إعداد بيئة العمل و Flutter SDK",
      "duration": "20:15",
      "isFreePreview": false,
      "isCompleted": false
    }
  ]
}
```

---

### 8.3 الاشتراكات وتقديم الدفع (Enrollments & Manual Payments)

#### `GET /api/payment-methods`
* **الوصف:** جلب طرق الدفع المتاحة للتحويل في المنصة (فودافون كاش، محفظة إلكترونية، حساب بنكي).
* **Response (200 OK):**
```json
[
  {
    "id": 1,
    "title": "فودافون كاش",
    "accountNumber": "01000000000",
    "accountName": "طفرة للتعليم",
    "instructions": "يرجى تحويل المبلغ ثم التقاط صورة واضحة لإيصال التحويل وارفاقها."
  },
  {
    "id": 2,
    "title": "تحويل بنكي (CIB)",
    "accountNumber": "EG12000000000000000000",
    "accountName": "Tafra Education LLC",
    "instructions": "ارفق صورة إشعار التحويل البنكي."
  }
]
```

#### `POST /api/enrollments/manual` (Multipart/form-data)
* **الوصف:** تقديم طلب اشتراك يدوي وإرفاق صورة إيصال التحويل.
* **Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
* **Form Data Body:**
  * `courseId`: `101`
  * `paymentMethodId`: `1`
  * `senderPhone`: `"01012345678"`
  * `receiptImage`: `[File / Image Bytes]` (الصورة الملتقطة للكاميرا أو المعرض)
* **Response (201 Created):**
```json
{
  "success": true,
  "message": "تم إرسال طلب الاشتراك بنجاح. سيتم مراجعة إيصال الدفع وتفعيل الكورس خلال ساعات قليلة.",
  "paymentId": 892
}
```

#### `GET /api/student/enrollments`
* **الوصف:** جلب الكورسات المشترك بها الطالب حالياً وحالتها (نشط / بانتظار تفعيل الدفع / مرفوض).
* **Response (200 OK):**
```json
[
  {
    "id": 33,
    "courseId": 101,
    "courseTitle": "كورس تطوير تطبيق Flutter احترافي",
    "status": "pending_approval", // or "active" or "rejected"
    "receiptUrl": "https://...",
    "progressPercentage": 0
  }
]
```

---

### 8.4 مشاهدة الدروس وتتبع الإنجاز (Lesson Stream & Progress)

#### `GET /api/lessons/:id`
* **الوصف:** جلب بيانات درس محدد مع رابط المشغّل والمرفقات.
* **Response (200 OK):**
```json
{
  "id": 501,
  "title": "مقدمة في أساسيات Dart",
  "videoUrl": "https://stream.tafra-learning.com/hls/lesson501.m3u8",
  "content": "شرح متعمق للمتغيرات والدوال...",
  "attachments": [
    { "name": "ملخص الدرس.pdf", "url": "https://..." }
  ],
  "nextLessonId": 502,
  "previousLessonId": null
}
```

#### `POST /api/lessons/:id/progress`
* **الوصف:** تسجيل إكمال الدرس أو تحديث وقت المشاهدة الحالي.
* **Body Request:**
```json
{
  "completed": true,
  "watchedSeconds": 765
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "courseProgressPercentage": 25.0
}
```

---

### 8.5 لوحة الأدمن ومراجعة الدفع (Admin Payment Approvals APIs)

#### `GET /api/admin/payments/pending`
* **الوصف:** جلب كافة طلبات الدفع المعلقة لمراجعة الإيصالات.
* **Headers:** `Authorization: Bearer <ADMIN_TOKEN>`
* **Response (200 OK):**
```json
[
  {
    "paymentId": 892,
    "studentName": "أحمد محمود",
    "studentEmail": "ahmed@example.com",
    "courseTitle": "كورس تطوير تطبيق Flutter احترافي",
    "amount": 450,
    "paymentMethod": "فودافون كاش",
    "senderPhone": "01012345678",
    "receiptImageUrl": "https://storage.tafra-learning.com/receipts/rec_892.jpg",
    "createdAt": "2026-09-28T18:30:00Z"
  }
]
```

#### `POST /api/admin/payments/:id/approve`
* **الوصف:** قبول إيصال الدفع وتفعيل الكورس للطالب فوراً.
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "تمت الموافقة على عملية الدفع وتفعيل الكورس للمستخدم بنجاح."
}
```

#### `POST /api/admin/payments/:id/reject`
* **الوصف:** رفض إيصال الدفع مع سبب الرفض.
* **Body Request:**
```json
{
  "reason": "صورة الإيصال غير واضحة ورقم العملية لا يطابق سجلات التحويل."
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "تم رفض طلب الدفع وإشعارات الطالب بالسبب."
}
```

---

## 9. ملخص متطلبات وتطبيق حزم Flutter الموصى بها (Flutter Package Blueprint)

لضمان حصول تطبيق Flutter على نفس الجودة والجمالية، يُوصى باستخدام الحزم التالية:

1. **إدارة الحالة والشبكة:**
   * `flutter_bloc` / `riverpod`: لإدارة حالة الكورسات والتحميل والدفع.
   * `dio`: لإرسال طلبات الـ REST API والتعامل مع رفع الصور `FormData`.
2. **واجهة المستخدم والتحميل الاحترافي:**
   * `skeletonizer` أو `shimmer`: لتطبيق هيكلية التحميل البصرية الفاخرة الموضحة في البند 3.
   * `google_fonts`: لاستدعاء خط `Changa` و `DM Sans`.
3. **التقاط الصور والكاميرا:**
   * `image_picker`: للتحكم الكامل في الخيارين (فتح الكاميرا فوراً `ImageSource.camera` أو فتح معرض الصور `ImageSource.gallery`).
4. **تشغيل الفيديوهات والمستندات:**
   * `video_player` / `chewie` / `better_player`: لتشغيل فيديوهات الدروس بدقة ومتابعة التقدم.
   * `flutter_pdfview`: لمشاهدة الملفات المرفقة داخل التطبيق.

---

> **ملاحظة:** تم كتابة وتصميم هذا المستند ليكون مرجعاً تقنياً شاملاً ومكتفياً ذاتياً لأي مطور Flutter يرغب في استبدال واجهة الويب أو بناء تطبيق هاتف متكامل مع الـ Backend القائم لمنصة طفرة التعليمية.
