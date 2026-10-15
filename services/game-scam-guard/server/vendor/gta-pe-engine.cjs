/* ============================================================
   GTA Guard — engine.js  (v2.2.0)
   ------------------------------------------------------------
   موتور تشخیص کاملاً سمت کاربر (client-side) برای فایل‌های
   مود GTA (.dll / .asi). هیچ سروری در کار نیست به‌جز:
     - بارگذاری rules.json از همان مبدأ (GitHub Pages)
     - یک درخواست اختیاری حاوی «فقط هش SHA-256» به سرویس اعتبار
       (URLhaus) برای بررسی شناخته‌شده بودن فایل به‌عنوان مخرب

   فایل آپلودشده هرگز اجرا، لود، نمونه‌سازی، کامپایل پویا، یا به
   هر شکلی «فعال» نمی‌شود. فقط بایت‌های خام آن به‌صورت ایستا
   (static) و با محدودیت‌های سخت‌گیرانه خوانده می‌شوند.

   معماری: چند-سیگنالی، مبتنی‌بر قابلیت (capability-based)، و
   دارای بودجهٔ اجرای محدود برای مقاومت در برابر فایل‌های بدشکل
   یا خصمانه. نتیجه هرگز قطعیت را ادعا نمی‌کند — فقط شواهد.

   محدودیت‌های شناخته‌شده (به‌صورت صادقانه مستند شده‌اند):
     - خود Engine مستقل از UI است و همچنان بودجهٔ تکرار (iteration
       budget) و پیمایش‌های bounded دارد. در build فعلی MalGuard،
       scan-worker.js این Engine را داخل Dedicated Web Worker اجرا
       می‌کند تا پردازش سنگین رشتهٔ اصلی UI را مسدود نکند. فقط در
       مرورگرهای فاقد Worker، لایهٔ سازگاری می‌تواند به main thread
       برگردد و این حالت در نتیجه با execution context مشخص می‌شود.
     - اعتبارسنجی امضای دیجیتال (Authenticode) و الگوریتم
       Checksum فایل PE پیاده‌سازی نشده‌اند؛ فقط وجود/اندازهٔ آن‌ها
       به‌صورت اطلاعاتی گزارش می‌شود.
     - تحلیل رشته‌ها برای فایل‌های بزرگ به یک پنجرهٔ محدود (ابتدا +
       انتهای فایل) محدود می‌شود، نه کل فایل — این یک مصالحهٔ
       آگاهانه بین ایمنی حافظه/کارایی و پوشش کامل است.
   ============================================================ */

'use strict';

const ENGINE_VERSION = '2.2.2';
const RULES_COMPATIBILITY = '2.2.0';

/* ------------------------------------------------------------
   کدهای خطای ساختاریافته (item 56)
   ------------------------------------------------------------ */
const ERROR_CODES = Object.freeze({
  INVALID_EXTENSION: 'INVALID_EXTENSION',
  EMPTY_FILE: 'EMPTY_FILE',
  TOO_LARGE: 'TOO_LARGE',
  READ_FAILED: 'READ_FAILED',
  CRYPTO_UNAVAILABLE: 'CRYPTO_UNAVAILABLE',
  HASH_FAILED: 'HASH_FAILED',
  READ_SIZE_MISMATCH: 'READ_SIZE_MISMATCH',
  INVALID_MZ: 'INVALID_MZ',
  INVALID_PE: 'INVALID_PE',
  MALFORMED_COFF: 'MALFORMED_COFF',
  MALFORMED_OPTIONAL_HEADER: 'MALFORMED_OPTIONAL_HEADER',
  MALFORMED_SECTION_TABLE: 'MALFORMED_SECTION_TABLE',
  MALFORMED_IMPORT_DIRECTORY: 'MALFORMED_IMPORT_DIRECTORY',
  INVALID_RVA: 'INVALID_RVA',
  OUT_OF_BOUNDS: 'OUT_OF_BOUNDS',
  PARSER_LIMIT_REACHED: 'PARSER_LIMIT_REACHED',
  RULES_LOAD_FAILED: 'RULES_LOAD_FAILED',
  SCAN_ERROR: 'SCAN_ERROR',
});

/* ------------------------------------------------------------
   محدودیت‌های سخت‌گیرانه (item 5, 15, 20, 36, 37)
   همهٔ این مقادیر سقف‌های صریح هستند؛ هیچ تخصیص حافظه یا حلقه‌ای
   بدون یکی از این سقف‌ها اجرا نمی‌شود.
   ------------------------------------------------------------ */
const LIMITS = Object.freeze({
  MAX_FILE_SIZE: 64 * 1024 * 1024,      // 64 مگابایت
  MAX_SECTIONS: 96,
  MAX_DATA_DIRECTORIES: 16,             // استاندارد PE؛ NumberOfRvaAndSizes هرگز فراتر از این اعتماد نمی‌شود
  MAX_IMPORT_DESCRIPTORS: 2000,
  MAX_THUNKS_PER_DESCRIPTOR: 4000,
  MAX_TLS_CALLBACKS: 64,
  MAX_PARSER_ITERATIONS: 200000,        // بودجهٔ سراسری تکرار برای کل تجزیهٔ PE
  STRING_SCAN_HEAD_BYTES: 8 * 1024 * 1024,   // پنجرهٔ ابتدای فایل برای اسکن رشته
  STRING_SCAN_TAIL_BYTES: 4 * 1024 * 1024,   // پنجرهٔ انتهای فایل برای اسکن رشته
  STRING_SCAN_FULL_THRESHOLD: 14 * 1024 * 1024, // اگر فایل کوچک‌تر از این باشد، کل آن اسکن می‌شود
  MAX_DLL_NAME_LENGTH: 256,
  MAX_IMPORT_NAME_LENGTH: 512,
  NETWORK_TIMEOUT_MS: 8000,
  MAX_REPUTATION_RESPONSE_BYTES: 200000,
});

/* ------------------------------------------------------------
   v2.2.0: سقف‌های ابعادی برای rules.json (item 6 از پچ v2.2.0).
   یک rules.json مخرب/خراب نباید بتواند با میلیون‌ها قانون، رشته‌های
   غول‌پیکر، یا آرایه‌های نامتناهی موتور را کند/فریز کند. این سقف‌ها
   نسبت به مجموعهٔ فعلی (۱۰۳ رشته/۳۵ ایمپورت/۲۶ نشانه/۶ ترکیب/۲۶ پکر)
   با فضای رشد معقول تعیین شده‌اند، نه بی‌دلیل سخت‌گیرانه.
   ------------------------------------------------------------ */
const RULES_LIMITS = Object.freeze({
  MAX_SUSPICIOUS_STRINGS: 3000,
  MAX_DANGEROUS_IMPORT_RULES: 1500,
  MAX_NAMES_PER_IMPORT_RULE: 40,
  MAX_GTA_MARKERS: 800,
  MAX_COMBINATION_RULES: 200,
  MAX_PACKER_SECTION_NAMES: 500,
  MAX_PATTERN_LENGTH: 512,
  MAX_ID_LENGTH: 64,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_CATEGORIES_PER_COMBO: 10,
});

/* ============================================================
   بخش ۱: اعتبارسنجی و بارگذاری امن rules.json (item 42-43)
   ============================================================ */

let _rulesCache = null;

const VALID_SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
const VALID_CONFIDENCES = new Set(['low', 'medium', 'high']);

function builtinFallbackRules() {
  // مجموعهٔ حداقلیِ خوداتکا برای زمانی که rules.json در دسترس نیست
  // یا معتبر نیست. این مجموعه خودش هم باید از validateRules عبور کند.
  return {
    version: 'builtin-fallback',
    engineVersionCompatibility: RULES_COMPATIBILITY,
    entropy_threshold: 7.0,
    max_score: 100,
    safe_threshold: 80,
    suspicious_threshold: 50,
    suspicious_strings: [
      { id: 'STR-FB-001', category: 'keylogging', pattern: 'keylog', type: 'string', severity: 'high', weight: 20, confidence: 'high', description: 'Explicit keylogger terminology.' },
      { id: 'STR-FB-002', category: 'command_execution', pattern: 'powershell.exe', type: 'string', severity: 'medium', weight: 10, confidence: 'medium', description: 'PowerShell interpreter reference.' },
      { id: 'STR-FB-003', category: 'credential_theft', pattern: 'login_data', type: 'string', severity: 'high', weight: 20, confidence: 'high', description: "Chromium 'Login Data' filename." },
    ],
    dangerous_imports: [
      { id: 'IMP-FB-001', capability: 'RemoteThreadCreation', category: 'process_injection', names: ['CreateRemoteThread'], severity: 'high', weight: 20, confidence: 'high', description: 'Remote thread creation.' },
      { id: 'IMP-FB-002', capability: 'RemoteMemoryWrite', category: 'process_injection', names: ['WriteProcessMemory'], severity: 'high', weight: 20, confidence: 'high', description: 'Remote memory write.' },
    ],
    gta_markers: [
      { id: 'GTA-FB-001', category: 'gta_context', pattern: 'gta', type: 'string', severity: 'info', weight: 0, confidence: 'high', description: 'Generic GTA reference.' },
      { id: 'GTA-FB-002', category: 'gta_context', pattern: 'scripthook', type: 'string', severity: 'info', weight: 0, confidence: 'high', description: 'ScriptHook reference.' },
    ],
    combination_rules: [],
    packer_section_names: ['.upx0', '.upx1', '.vmp0', '.themida', '.aspack'],
    ordinal_import_heuristic: null,
    extension_mismatch_heuristic: null,
    timestamp_anomaly_heuristic: null,
  };
}

/** بررسی می‌کند یک عدد واقعاً محدود و متناهی است (نه NaN/Infinity) */
function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * اعتبارسنجی ساختاری rules.json (item 42). در صورت هرگونه مشکل،
 * یک آرایه از پیام‌های خطا برمی‌گرداند؛ آرایهٔ خالی یعنی معتبر است.
 * این تابع هرگز استثنا پرتاب نمی‌کند.
 */
function validateRules(data) {
  const errors = [];
  try {
    if (!data || typeof data !== 'object') return ['rules.json یک آبجکت نیست'];

    if (!Array.isArray(data.suspicious_strings)) errors.push('suspicious_strings آرایه نیست');
    if (!Array.isArray(data.dangerous_imports)) errors.push('dangerous_imports آرایه نیست');
    if (!Array.isArray(data.gta_markers)) errors.push('gta_markers آرایه نیست');
    if (data.combination_rules !== undefined && !Array.isArray(data.combination_rules)) {
      errors.push('combination_rules باید آرایه باشد');
    }
    if (data.packer_section_names !== undefined && !Array.isArray(data.packer_section_names)) {
      errors.push('packer_section_names باید آرایه باشد');
    }
    if (errors.length) return errors; // بدون آرایه‌های پایه، ادامه دادن بی‌فایده است

    // --- v2.2.0: سقف‌های ابعادی — جلوگیری از سوءاستفادهٔ منابع توسط
    // یک rules.json مخرب/خراب حاوی تعداد نامعقول قانون (item 6) ---
    if (data.suspicious_strings.length > RULES_LIMITS.MAX_SUSPICIOUS_STRINGS) {
      errors.push('suspicious_strings بیش از حد مجاز (' + RULES_LIMITS.MAX_SUSPICIOUS_STRINGS + ') است');
    }
    if (data.dangerous_imports.length > RULES_LIMITS.MAX_DANGEROUS_IMPORT_RULES) {
      errors.push('dangerous_imports بیش از حد مجاز (' + RULES_LIMITS.MAX_DANGEROUS_IMPORT_RULES + ') است');
    }
    if (data.gta_markers.length > RULES_LIMITS.MAX_GTA_MARKERS) {
      errors.push('gta_markers بیش از حد مجاز (' + RULES_LIMITS.MAX_GTA_MARKERS + ') است');
    }
    if (Array.isArray(data.combination_rules) && data.combination_rules.length > RULES_LIMITS.MAX_COMBINATION_RULES) {
      errors.push('combination_rules بیش از حد مجاز (' + RULES_LIMITS.MAX_COMBINATION_RULES + ') است');
    }
    if (Array.isArray(data.packer_section_names) && data.packer_section_names.length > RULES_LIMITS.MAX_PACKER_SECTION_NAMES) {
      errors.push('packer_section_names بیش از حد مجاز (' + RULES_LIMITS.MAX_PACKER_SECTION_NAMES + ') است');
    }
    if (errors.length) return errors; // اگر ابعاد نامعقول است، بازرسی ریزتر بی‌فایده است

    if (!isFiniteNumber(data.entropy_threshold) || data.entropy_threshold < 0 || data.entropy_threshold > 8) {
      errors.push('entropy_threshold نامعتبر است');
    }
    if (!isFiniteNumber(data.max_score) || data.max_score <= 0 || data.max_score > 100) {
      errors.push('max_score نامعتبر است (باید در بازهٔ 1..100 باشد)');
    }
    if (!isFiniteNumber(data.safe_threshold) || !isFiniteNumber(data.suspicious_threshold)) {
      errors.push('آستانه‌ها نامعتبرند');
    } else {
      if (data.suspicious_threshold < 0 || data.safe_threshold < 0) {
        errors.push('آستانه‌ها نمی‌توانند منفی باشند');
      }
      if (isFiniteNumber(data.max_score) &&
          (data.suspicious_threshold > data.max_score || data.safe_threshold > data.max_score)) {
        errors.push('آستانه‌ها نباید از max_score بزرگ‌تر باشند');
      }
      if (data.suspicious_threshold > data.safe_threshold) {
        errors.push('suspicious_threshold نباید بزرگ‌تر از safe_threshold باشد');
      }
    }

    const seenStringIds = new Set();
    const seenStringPatterns = new Set();
    for (const rule of data.suspicious_strings) {
      if (!rule || typeof rule.pattern !== 'string' || !rule.pattern.trim()) {
        errors.push('یک قانون رشته‌ای بدون pattern معتبر یافت شد'); continue;
      }
      if (rule.pattern.length > RULES_LIMITS.MAX_PATTERN_LENGTH) {
        errors.push('pattern بیش از حد طولانی در ' + rule.id);
      }
      if (typeof rule.id !== 'string' || rule.id.length > RULES_LIMITS.MAX_ID_LENGTH || seenStringIds.has(rule.id)) {
        errors.push('id تکراری/نامعتبر در suspicious_strings: ' + rule.id);
      }
      if (rule.description !== undefined &&
          (typeof rule.description !== 'string' || rule.description.length > RULES_LIMITS.MAX_DESCRIPTION_LENGTH)) {
        errors.push('description نامعتبر/بیش‌ازحد‌طولانی در ' + rule.id);
      }
      seenStringIds.add(rule.id);
      const normPattern = rule.pattern.toLowerCase();
      if (seenStringPatterns.has(normPattern)) {
        errors.push('pattern تکراری در suspicious_strings: ' + normPattern);
      }
      seenStringPatterns.add(normPattern);
      if (!VALID_SEVERITIES.has(rule.severity)) errors.push('severity نامعتبر: ' + rule.severity);
      if (!VALID_CONFIDENCES.has(rule.confidence)) errors.push('confidence نامعتبر: ' + rule.confidence);
      if (!isFiniteNumber(rule.weight) || rule.weight < 0 || rule.weight > 100) {
        errors.push('weight نامعتبر برای ' + rule.id);
      }
    }

    const seenImportIds = new Set();
    const seenImportNames = new Set();
    for (const rule of data.dangerous_imports) {
      if (!rule || !Array.isArray(rule.names) || rule.names.length === 0) {
        errors.push('یک قانون ایمپورت بدون names معتبر یافت شد'); continue;
      }
      if (rule.names.length > RULES_LIMITS.MAX_NAMES_PER_IMPORT_RULE) {
        errors.push('names بیش از حد مجاز در ' + rule.id);
      }
      if (typeof rule.id !== 'string' || rule.id.length > RULES_LIMITS.MAX_ID_LENGTH || seenImportIds.has(rule.id)) {
        errors.push('id تکراری/نامعتبر در dangerous_imports: ' + rule.id);
      }
      seenImportIds.add(rule.id);
      for (const n of rule.names) {
        if (typeof n !== 'string' || !n) { errors.push('نام ایمپورت نامعتبر در ' + rule.id); continue; }
        const key = n.toLowerCase();
        if (seenImportNames.has(key)) errors.push('نام ایمپورت تکراری در چند قانون: ' + n);
        seenImportNames.add(key);
      }
      if (!VALID_SEVERITIES.has(rule.severity)) errors.push('severity نامعتبر برای ' + rule.id);
      if (!VALID_CONFIDENCES.has(rule.confidence)) errors.push('confidence نامعتبر برای ' + rule.id);
      if (!isFiniteNumber(rule.weight) || rule.weight < 0 || rule.weight > 100) {
        errors.push('weight نامعتبر برای ' + rule.id);
      }
    }

    const seenMarkerIds = new Set();
    for (const rule of data.gta_markers) {
      if (!rule || typeof rule.pattern !== 'string' || !rule.pattern.trim()) {
        errors.push('یک نشانهٔ GTA بدون pattern معتبر یافت شد'); continue;
      }
      if (rule.pattern.length > RULES_LIMITS.MAX_PATTERN_LENGTH) {
        errors.push('pattern بیش از حد طولانی در ' + rule.id);
      }
      if (typeof rule.id !== 'string' || rule.id.length > RULES_LIMITS.MAX_ID_LENGTH || seenMarkerIds.has(rule.id)) {
        errors.push('id تکراری/نامعتبر در gta_markers: ' + rule.id);
      }
      seenMarkerIds.add(rule.id);
    }

    // --- v2.2.0: اعتبارسنجی packer_section_names (item 5 از پچ) ---
    if (Array.isArray(data.packer_section_names)) {
      const seenPacker = new Set();
      for (const p of data.packer_section_names) {
        if (typeof p !== 'string' || !p.trim()) { errors.push('یک نام سکشن پکر نامعتبر است'); continue; }
        if (p.length > RULES_LIMITS.MAX_PATTERN_LENGTH) { errors.push('نام سکشن پکر بیش از حد طولانی است: ' + p); continue; }
        const key = p.toLowerCase();
        if (seenPacker.has(key)) errors.push('نام سکشن پکر تکراری: ' + p);
        seenPacker.add(key);
      }
    }

    // --- combination_rules: پشتیبانی از دو نوع ترکیب —
    //   (الف) requires_categories: چند دستهٔ مستقل هم‌زمان
    //   (ب) requires_multiple_in_category: چند قانون مجزا در یک دسته
    // (item 4/2 از پچ v2.2.0: افزودن risk_floor اختیاری) ---
    if (Array.isArray(data.combination_rules)) {
      const seenComboIds = new Set();
      const VALID_RISK_FLOORS = new Set(['suspicious', 'malicious']);
      for (const combo of data.combination_rules) {
        if (!combo || typeof combo.id !== 'string' || combo.id.length > RULES_LIMITS.MAX_ID_LENGTH || seenComboIds.has(combo.id)) {
          errors.push('combination_rules دارای id تکراری/نامعتبر است'); continue;
        }
        seenComboIds.add(combo.id);

        const hasCategoryForm = combo.requires_categories !== undefined;
        const hasMultiplicityForm = combo.requires_multiple_in_category !== undefined;

        if (!hasCategoryForm && !hasMultiplicityForm) {
          errors.push('combo ' + combo.id + ' باید requires_categories یا requires_multiple_in_category داشته باشد');
        }

        if (hasCategoryForm) {
          if (!Array.isArray(combo.requires_categories) ||
              combo.requires_categories.length < 2 ||
              combo.requires_categories.length > RULES_LIMITS.MAX_CATEGORIES_PER_COMBO ||
              !combo.requires_categories.every(c => typeof c === 'string' && c.length <= RULES_LIMITS.MAX_ID_LENGTH)) {
            errors.push('combo ' + combo.id + ' نیازمند حداقل دو دستهٔ رشته‌ای معتبر در requires_categories است');
          }
          if (combo.min_categories_matched !== undefined &&
              (!Number.isInteger(combo.min_categories_matched) || combo.min_categories_matched < 2)) {
            errors.push('min_categories_matched نامعتبر برای combo ' + combo.id);
          }
        }

        if (hasMultiplicityForm) {
          const m = combo.requires_multiple_in_category;
          if (!m || typeof m.category !== 'string' || !m.category.trim() ||
              !Number.isInteger(m.min_distinct_rules) || m.min_distinct_rules < 2 || m.min_distinct_rules > 50) {
            errors.push('requires_multiple_in_category نامعتبر برای combo ' + combo.id);
          }
        }

        if (!isFiniteNumber(combo.bonus_weight) || combo.bonus_weight < 0 || combo.bonus_weight > 100) {
          errors.push('bonus_weight نامعتبر برای combo ' + combo.id);
        }
        if (combo.confidence !== undefined && !VALID_CONFIDENCES.has(combo.confidence)) {
          errors.push('confidence نامعتبر برای combo ' + combo.id);
        }
        if (combo.severity !== undefined && !VALID_SEVERITIES.has(combo.severity)) {
          errors.push('severity نامعتبر برای combo ' + combo.id);
        }
        if (combo.risk_floor !== undefined && !VALID_RISK_FLOORS.has(combo.risk_floor)) {
          errors.push('risk_floor نامعتبر برای combo ' + combo.id + ' (باید suspicious یا malicious باشد)');
        }
      }
    }

    // --- v2.2.0: اعتبارسنجی آبجکت‌های heuristic اختیاری (item 5 از پچ) ---
    function validateHeuristicObject(obj, name, extraNumericFields) {
      if (obj === undefined || obj === null) return; // اختیاری است
      if (typeof obj !== 'object') { errors.push(name + ' باید یک آبجکت یا null باشد'); return; }
      if (typeof obj.id !== 'string' || !obj.id.trim() || obj.id.length > RULES_LIMITS.MAX_ID_LENGTH) {
        errors.push(name + '.id نامعتبر است');
      }
      if (!VALID_SEVERITIES.has(obj.severity)) errors.push(name + '.severity نامعتبر است');
      if (!VALID_CONFIDENCES.has(obj.confidence)) errors.push(name + '.confidence نامعتبر است');
      if (!isFiniteNumber(obj.weight) || obj.weight < 0 || obj.weight > 100) {
        errors.push(name + '.weight نامعتبر است');
      }
      if (typeof obj.category !== 'string' || !obj.category.trim()) {
        errors.push(name + '.category نامعتبر است');
      }
      if (obj.description !== undefined &&
          (typeof obj.description !== 'string' || obj.description.length > RULES_LIMITS.MAX_DESCRIPTION_LENGTH)) {
        errors.push(name + '.description نامعتبر/بیش‌ازحد‌طولانی است');
      }
      for (const field of (extraNumericFields || [])) {
        if (!isFiniteNumber(obj[field])) errors.push(name + '.' + field + ' باید یک عدد معتبر باشد');
      }
    }
    validateHeuristicObject(data.ordinal_import_heuristic, 'ordinal_import_heuristic', ['min_total_imports', 'ratio_threshold']);
    validateHeuristicObject(data.extension_mismatch_heuristic, 'extension_mismatch_heuristic', []);
    validateHeuristicObject(data.timestamp_anomaly_heuristic, 'timestamp_anomaly_heuristic', []);
    if (data.ordinal_import_heuristic && (
        data.ordinal_import_heuristic.ratio_threshold < 0 || data.ordinal_import_heuristic.ratio_threshold > 1 ||
        data.ordinal_import_heuristic.min_total_imports < 1)) {
      errors.push('ordinal_import_heuristic دارای مقادیر عددی خارج از محدودهٔ مجاز است');
    }

    return errors;
  } catch (err) {
    return ['استثنای غیرمنتظره در اعتبارسنجی rules.json: ' + String(err && err.message)];
  }
}

/** نرمال‌سازی یک‌بارهٔ الگوها هنگام بارگذاری (item 24) */
function normalizeRules(data) {
  const norm = (s) => String(s).toLowerCase();
  for (const r of data.suspicious_strings) r.pattern = norm(r.pattern);
  for (const r of data.gta_markers) r.pattern = norm(r.pattern);
  for (const r of data.dangerous_imports) {
    r._namesLower = r.names.map(norm); // برای جستجوی سریع O(1) در Set
  }
  if (Array.isArray(data.packer_section_names)) {
    data._packerSectionSetLower = new Set(data.packer_section_names.map(norm));
  } else {
    data._packerSectionSetLower = new Set();
  }
  return data;
}

/**
 * وضعیت قوانین را مشخص می‌کند (item 4 و 7 از پچ v2.2.0):
 *   - "official"     : بارگذاری، اعتبارسنجی، و سازگاری نسخه با موفقیت تأیید شد
 *   - "incompatible" : ساختاراً معتبر است اما engineVersionCompatibility با
 *                      نسخهٔ فعلی موتور مطابقت ندارد — به‌طور خاموش پذیرفته نمی‌شود
 *   - "fallback"      : بارگذاری/اعتبارسنجی ناموفق بود یا ناسازگار بود؛ از
 *                      مجموعهٔ حداقلی داخلی استفاده می‌شود
 * این وضعیت در نتیجهٔ نهایی اسکن (rulesStatus) به کاربر نشان داده می‌شود؛
 * هرگز به‌صورت خاموش نادیده گرفته نمی‌شود.
 */
async function loadRules() {
  if (_rulesCache) return _rulesCache;

  let data = null;
  let loadError = null;
  let status = 'official';
  let statusReason = null;

  try {
    const res = await fetch('rules.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (err) {
    loadError = err;
  }

  if (data) {
    const errors = validateRules(data);
    if (errors.length > 0) {
      console.error('rules.json نامعتبر است، استفاده از مجموعهٔ داخلی جایگزین. خطاها:', errors);
      data = null;
      status = 'fallback';
      statusReason = 'validation_failed';
    } else if (typeof data.engineVersionCompatibility !== 'string' ||
               data.engineVersionCompatibility !== RULES_COMPATIBILITY) {
      // ساختاراً معتبر است، اما نسخهٔ سازگاری اعلام‌شده با موتور فعلی یکی
      // نیست. طبق مشخصات، این حالت هرگز نباید به‌صورت خاموش «سازگار»
      // فرض شود — رد می‌شود و به مجموعهٔ داخلی برمی‌گردیم.
      console.error(
        'rules.json ناسازگار است: engineVersionCompatibility=' +
        data.engineVersionCompatibility + ' ، مورد انتظار=' + RULES_COMPATIBILITY
      );
      data = null;
      status = 'incompatible';
      statusReason = 'version_mismatch';
    }
  } else {
    status = 'fallback';
    statusReason = 'load_failed';
  }

  if (!data) {
    if (loadError) console.error('بارگذاری rules.json ناموفق بود:', loadError);
    data = builtinFallbackRules();
    const fbErrors = validateRules(data);
    if (fbErrors.length > 0) {
      // این نباید هرگز رخ دهد؛ اگر رخ دهد یعنی خود fallback باگ دارد.
      console.error('مجموعهٔ داخلی جایگزین نیز نامعتبر است!', fbErrors);
    }
  }

  _rulesCache = normalizeRules(data);
  _rulesCache.status = status;
  _rulesCache.statusReason = statusReason;
  return _rulesCache;
}

/* ============================================================
   بخش ۲: ابزارهای امن دسترسی به بایت (bounds-checked)  (item 5)
   ============================================================ */

/**
 * بررسی می‌کند offset..offset+size کاملاً درون [0, totalLength] است.
 * از سرریز/زیرریز عدد صحیح جلوگیری می‌کند و اعداد غیر-صحیح‌-امن را رد می‌کند.
 */
function inBounds(totalLength, offset, size) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size)) return false;
  if (offset < 0 || size < 0) return false;
  if (offset > totalLength) return false;
  return size <= totalLength - offset;
}

function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

async function computeSha256(buffer) {
  if (!window.crypto || !window.crypto.subtle) throw new Error('CRYPTO_UNAVAILABLE');
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return bufferToHex(digest);
}

function computeShannonEntropy(bytes) {
  const total = bytes.length;
  if (total === 0) return 0;
  const counts = new Array(256).fill(0);
  for (let i = 0; i < total; i++) counts[bytes[i]]++;
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (counts[i] === 0) continue;
    const p = counts[i] / total;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/** بودجهٔ تکرار سراسری برای حلقه‌های تحت‌تأثیر داده‌های آلوده (item 36) */
function consumeBudget(state, amount = 1) {
  state.iterations += amount;
  if (state.iterations > LIMITS.MAX_PARSER_ITERATIONS) {
    const e = new Error('PARSER_LIMIT_REACHED');
    e.code = ERROR_CODES.PARSER_LIMIT_REACHED;
    throw e;
  }
}

/* ============================================================
   بخش ۳: پارسر دفاعی PE  (items 6-17, 30-35)
   همهٔ آفست‌ها/RVAها قبل از خواندن با inBounds بررسی می‌شوند.
   هیچ بایتی از فایل هرگز اجرا یا لود نمی‌شود — فقط خوانده می‌شود.
   ============================================================ */

function readUint64AsNumber(view, offset) {
  // مقداری غیرمنفی که در محدودهٔ safe-integer جاوااسکریپت باشد را
  // به‌عنوان یک عدد معمولی برمی‌گرداند (برای ImageBase/VAها کافی است).
  // نگه‌داشته شده برای سازگاری با فراخوانی‌های داخلی؛ کد جدید باید
  // readUint64Safe را ترجیح دهد که مقادیر ناایمن را صراحتاً رد می‌کند.
  const low = view.getUint32(offset, true);
  const high = view.getUint32(offset + 4, true);
  return high * 4294967296 + low; // 2^32
}

/**
 * نسخهٔ دفاعی خواندن یک مقدار ۶۴-بیتی (item 10 از پچ v2.2.0).
 * اگر مقدار در محدودهٔ Number.MAX_SAFE_INTEGER (۲^۵۳-۱) جا نشود،
 * safe:false برمی‌گرداند تا فراخواننده آن عملیات را به‌طور کامل رد کند
 * — هرگز اجازه نمی‌دهیم یک عدد ۶۴-بیتی سرریزشده به‌عنوان یک آفست/RVA
 * «معتبر به‌نظر برسد».
 */
function readUint64Safe(view, offset) {
  const low = view.getUint32(offset, true);
  const high = view.getUint32(offset + 4, true);
  // 2^53 در تقسیم بر 2^32 تقریباً 2097152 (0x200000) است؛ برای حاشیهٔ
  // اطمینان از high < 0x200000 استفاده می‌کنیم که تضمین می‌کند
  // high*2^32+low همیشه از Number.MAX_SAFE_INTEGER کمتر بماند.
  if (high >= 0x200000) return { safe: false, value: null };
  return { safe: true, value: high * 4294967296 + low };
}

function readAsciiCString(bytes, totalLen, offset, maxLen) {
  if (!inBounds(totalLen, offset, 0)) return null;
  let end = offset;
  const maxEnd = Math.min(totalLen, offset + maxLen);
  while (end < maxEnd && bytes[end] !== 0) end++;
  if (end === offset) return '';
  if (end >= maxEnd && bytes[end - 1] !== 0) {
    // رشته به سقف طول مجاز رسید و null-terminator پیدا نشد
    return null;
  }
  let s = '';
  for (let i = offset; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/**
 * تجزیهٔ دفاعی ساختار PE. هرگز استثنا به بیرون پرتاب نمی‌کند؛ در عوض
 * { valid: false, reason, errorCode } برمی‌گرداند.
 */
function parsePeStructure(buffer) {
  const bytes = new Uint8Array(buffer);
  const totalLen = bytes.length;
  const state = { iterations: 0 };

  const result = {
    valid: false,
    reason: null,
    errorCode: null,
    is64: null,
    numberOfSections: 0,
    sections: [],
    imports: [],          // [{ dll, name, ordinal }]
    ordinalImportCount: 0,
    namedImportCount: 0,
    entryPointRva: null,
    entryPointSection: null,
    timestamp: null,
    imageBase: null,
    checksumField: null,
    dllCharacteristics: null,
    isDllFlagSet: null,
    numberOfRvaAndSizesRaw: null,
    numberOfRvaAndSizesUsed: 0,
    tls: { present: false, callbackCount: null, note: null },
    resource: { present: false, size: 0, sectionName: null, entropy: null },
    security: { present: false, size: 0 },
    overlay: { present: false, offset: null, size: 0, entropy: null },
  };

  try {
    if (totalLen < 0x40) { result.reason = 'too_small'; result.errorCode = ERROR_CODES.INVALID_MZ; return result; }

    const view = new DataView(buffer);

    if (!inBounds(totalLen, 0, 2) || view.getUint16(0, true) !== 0x5a4d) {
      result.reason = 'no_mz'; result.errorCode = ERROR_CODES.INVALID_MZ; return result;
    }

    if (!inBounds(totalLen, 0x3c, 4)) { result.reason = 'bad_offset'; result.errorCode = ERROR_CODES.INVALID_PE; return result; }
    const peHeaderOffset = view.getUint32(0x3c, true);
    if (!inBounds(totalLen, peHeaderOffset, 24)) {
      result.reason = 'bad_pe_offset'; result.errorCode = ERROR_CODES.INVALID_PE; return result;
    }

    const sig = view.getUint32(peHeaderOffset, true);
    if (sig !== 0x00004550) { result.reason = 'no_pe_sig'; result.errorCode = ERROR_CODES.INVALID_PE; return result; }

    const coffHeaderOffset = peHeaderOffset + 4;
    if (!inBounds(totalLen, coffHeaderOffset, 20)) {
      result.reason = 'bad_coff'; result.errorCode = ERROR_CODES.MALFORMED_COFF; return result;
    }

    const characteristics = view.getUint16(coffHeaderOffset + 18, true);
    result.dllCharacteristics = characteristics;
    result.isDllFlagSet = (characteristics & 0x2000) !== 0; // IMAGE_FILE_DLL

    const numberOfSections = view.getUint16(coffHeaderOffset + 2, true);
    const timestamp = view.getUint32(coffHeaderOffset + 4, true);
    const sizeOfOptionalHeader = view.getUint16(coffHeaderOffset + 16, true);

    if (numberOfSections === 0 || numberOfSections > LIMITS.MAX_SECTIONS) {
      result.reason = 'bad_section_count'; result.errorCode = ERROR_CODES.MALFORMED_COFF; return result;
    }
    result.numberOfSections = numberOfSections;
    result.timestamp = timestamp;

    const optionalHeaderOffset = coffHeaderOffset + 20;
    if (sizeOfOptionalHeader === 0 || !inBounds(totalLen, optionalHeaderOffset, sizeOfOptionalHeader)) {
      result.reason = 'bad_optional_header'; result.errorCode = ERROR_CODES.MALFORMED_OPTIONAL_HEADER; return result;
    }
    // حداقل اندازهٔ معقول برای خواندن magic + فیلدهای پایه
    if (sizeOfOptionalHeader < 24) {
      result.reason = 'optional_header_too_small'; result.errorCode = ERROR_CODES.MALFORMED_OPTIONAL_HEADER; return result;
    }

    const magic = view.getUint16(optionalHeaderOffset, true);
    let is64;
    if (magic === 0x10b) is64 = false;
    else if (magic === 0x20b) is64 = true;
    else { result.reason = 'unknown_magic'; result.errorCode = ERROR_CODES.MALFORMED_OPTIONAL_HEADER; return result; }
    result.is64 = is64;

    if (inBounds(totalLen, optionalHeaderOffset + 16, 4)) {
      result.entryPointRva = view.getUint32(optionalHeaderOffset + 16, true);
    }

    const imageBaseOffset = optionalHeaderOffset + (is64 ? 24 : 28);
    const imageBaseSize = is64 ? 8 : 4;
    if (inBounds(totalLen, imageBaseOffset, imageBaseSize)) {
      if (is64) {
        // item 10 از پچ v2.2.0: اگر ImageBase ۶۴-بیتی در محدودهٔ
        // safe-integer جاوااسکریپت جا نشود، آن را کاملاً نادیده می‌گیریم
        // (imageBase=null) تا محاسبات RVA/TLS بعدی که به آن وابسته‌اند
        // به‌جای تولید یک آفست «معتبر به‌نظر» ولی نادرست، خاموش رد شوند.
        const safeImageBase = readUint64Safe(view, imageBaseOffset);
        result.imageBase = safeImageBase.safe ? safeImageBase.value : null;
      } else {
        result.imageBase = view.getUint32(imageBaseOffset, true);
      }
    }

    if (inBounds(totalLen, optionalHeaderOffset + 64, 4)) {
      result.checksumField = view.getUint32(optionalHeaderOffset + 64, true);
    }

    // --- NumberOfRvaAndSizes: هرگز مستقیماً اعتماد نمی‌شود (item 9/10) ---
    const numRvaOffset = optionalHeaderOffset + (is64 ? 108 : 92);
    let numberOfRvaAndSizesRaw = 0;
    if (inBounds(totalLen, numRvaOffset, 4)) {
      numberOfRvaAndSizesRaw = view.getUint32(numRvaOffset, true);
    }
    result.numberOfRvaAndSizesRaw = numberOfRvaAndSizesRaw;
    const directoryCount = Math.min(numberOfRvaAndSizesRaw, LIMITS.MAX_DATA_DIRECTORIES);
    result.numberOfRvaAndSizesUsed = directoryCount;

    const dataDirBase = optionalHeaderOffset + (is64 ? 112 : 96);
    // تضمین می‌کنیم آرایهٔ دایرکتوری‌ها واقعاً درون Optional Header جا می‌شود
    const actualDirectoryCount = inBounds(totalLen, dataDirBase, directoryCount * 8)
      ? directoryCount
      : Math.max(0, Math.floor((sizeOfOptionalHeader - (dataDirBase - optionalHeaderOffset)) / 8));

    function getDataDirectory(index) {
      if (index < 0 || index >= actualDirectoryCount) return null;
      const off = dataDirBase + index * 8;
      if (!inBounds(totalLen, off, 8)) return null;
      const va = view.getUint32(off, true);
      const size = view.getUint32(off + 4, true);
      if (va === 0 || size === 0) return null;
      return { va, size };
    }

    // --- جدول سکشن‌ها (item 11) ---
    const sectionTableOffset = optionalHeaderOffset + sizeOfOptionalHeader;
    const sectionHeaderSize = 40;
    const requiredSectionTableSize = numberOfSections * sectionHeaderSize;
    if (!inBounds(totalLen, sectionTableOffset, requiredSectionTableSize)) {
      // فایل ادعای N سکشن دارد اما به اندازهٔ کافی برای N هدر سکشن نیست
      result.reason = 'section_table_truncated';
      result.errorCode = ERROR_CODES.MALFORMED_SECTION_TABLE;
      return result;
    }

    const sections = [];
    for (let i = 0; i < numberOfSections; i++) {
      consumeBudget(state);
      const secOffset = sectionTableOffset + i * sectionHeaderSize;

      let name = '';
      for (let k = 0; k < 8; k++) {
        const b = bytes[secOffset + k];
        if (b === 0) break;
        name += String.fromCharCode(b);
      }

      const virtualSize = view.getUint32(secOffset + 8, true);
      const virtualAddress = view.getUint32(secOffset + 12, true);
      const rawSize = view.getUint32(secOffset + 16, true);
      const rawPointer = view.getUint32(secOffset + 20, true);
      const secChar = view.getUint32(secOffset + 36, true);

      const executable = (secChar & 0x20000000) !== 0;
      const writable = (secChar & 0x80000000) !== 0;
      const readable = (secChar & 0x40000000) !== 0;

      let entropy = null;
      let dataAvailable = false;
      if (rawSize > 0 && inBounds(totalLen, rawPointer, rawSize)) {
        dataAvailable = true;
        entropy = computeShannonEntropy(bytes.subarray(rawPointer, rawPointer + rawSize));
      }

      sections.push({
        name, virtualSize, virtualAddress, rawSize, rawPointer,
        executable, writable, readable, entropy, dataAvailable
      });
    }
    result.sections = sections;

    // --- RVA -> آفست فایل، کاملاً دفاعی (item 12) ---
    function rvaToOffset(rva, requiredSize) {
      // item 11 از پچ v2.2.0: اعتبارسنجی صریح هر دو ورودی قبل از هر
      // محاسبهٔ حسابی — هیچ مسیری نباید بتواند بدون بررسی به جمع/تفریق برسد.
      const reqSize = requiredSize || 0;
      if (!Number.isSafeInteger(rva) || rva < 0) return -1;
      if (!Number.isSafeInteger(reqSize) || reqSize < 0) return -1;
      for (const sec of sections) {
        // spanSize/virtualAddress همیشه از یک Uint32 خوانده شده‌اند، پس
        // خودشان ایمن‌اند؛ فقط ترکیب آن‌ها را می‌سنجیم.
        const spanSize = Math.max(sec.virtualSize, sec.rawSize);
        const sectionEnd = sec.virtualAddress + spanSize; // حداکثر 2^33، همچنان safe-integer
        if (rva >= sec.virtualAddress && rva < sectionEnd) {
          const delta = rva - sec.virtualAddress;
          const off = sec.rawPointer + delta;
          if (!Number.isSafeInteger(off)) return -1;
          if (!inBounds(totalLen, off, reqSize)) return -1;
          return off;
        }
      }
      return -1;
    }

    // --- نقطهٔ ورود و سکشن آن ---
    if (result.entryPointRva != null) {
      for (const sec of sections) {
        const spanSize = Math.max(sec.virtualSize, sec.rawSize);
        if (result.entryPointRva >= sec.virtualAddress && result.entryPointRva < sec.virtualAddress + spanSize) {
          result.entryPointSection = sec.name;
          break;
        }
      }
    }

    // --- جدول Import (Data Directory ایندکس 1)، با DLL context (item 15-17) ---
    const importDir = getDataDirectory(1);
    if (importDir) {
      const importTableOffset = rvaToOffset(importDir.va, 20);
      if (importTableOffset >= 0) {
        const imports = [];
        const descriptorSize = 20;
        let descOffset = importTableOffset;
        let descCount = 0;
        let ordinalCount = 0;
        let namedCount = 0;

        while (descCount < LIMITS.MAX_IMPORT_DESCRIPTORS) {
          consumeBudget(state);
          descCount++;
          if (!inBounds(totalLen, descOffset, descriptorSize)) break;

          const originalFirstThunk = view.getUint32(descOffset, true);
          const nameRva = view.getUint32(descOffset + 12, true);
          const firstThunk = view.getUint32(descOffset + 16, true);

          if (originalFirstThunk === 0 && nameRva === 0 && firstThunk === 0) break;

          let dllName = null;
          const dllNameOffset = rvaToOffset(nameRva, 1);
          if (dllNameOffset >= 0) {
            dllName = readAsciiCString(bytes, totalLen, dllNameOffset, LIMITS.MAX_DLL_NAME_LENGTH) || '(نامعتبر)';
          }

          const thunkRva = originalFirstThunk !== 0 ? originalFirstThunk : firstThunk;
          const thunkEntrySize = is64 ? 8 : 4;
          let thunkOffset = rvaToOffset(thunkRva, thunkEntrySize);

          if (thunkOffset >= 0) {
            let thunkCount = 0;
            while (thunkCount < LIMITS.MAX_THUNKS_PER_DESCRIPTOR) {
              consumeBudget(state);
              thunkCount++;
              if (!inBounds(totalLen, thunkOffset, thunkEntrySize)) break;

              let low, high = 0, isOrdinal, isZero;
              if (is64) {
                low = view.getUint32(thunkOffset, true);
                high = view.getUint32(thunkOffset + 4, true);
                isOrdinal = (high & 0x80000000) !== 0;
                isZero = (low === 0 && high === 0);
              } else {
                low = view.getUint32(thunkOffset, true);
                isOrdinal = (low & 0x80000000) !== 0;
                isZero = (low === 0);
              }
              if (isZero) break;

              if (isOrdinal) {
                const ordinal = low & 0xffff;
                ordinalCount++;
                imports.push({ dll: dllName, name: null, ordinal });
              } else {
                const ibnRva = low; // در PE32+ فقط 32 بیت پایین برای RVA نام معنادار است
                const ibnOffset = rvaToOffset(ibnRva, 2);
                if (ibnOffset >= 0) {
                  const nameOffset = ibnOffset + 2; // 2 بایت hint را رد می‌کنیم
                  const fname = readAsciiCString(bytes, totalLen, nameOffset, LIMITS.MAX_IMPORT_NAME_LENGTH);
                  if (fname) {
                    namedCount++;
                    imports.push({ dll: dllName, name: fname, ordinal: null });
                  }
                }
              }

              thunkOffset += thunkEntrySize;
            }
          }

          descOffset += descriptorSize;
        }

        result.imports = imports;
        result.ordinalImportCount = ordinalCount;
        result.namedImportCount = namedCount;
      }
    }

    // --- TLS Directory (ایندکس 9) — فقط برای شناسایی callback ها ---
    const tlsDir = getDataDirectory(9);
    if (tlsDir) {
      result.tls.present = true;
      try {
        const tlsOffset = rvaToOffset(tlsDir.va, is64 ? 40 : 24);
        if (tlsOffset >= 0 && result.imageBase != null) {
          const callbacksVaOffset = tlsOffset + (is64 ? 24 : 12);
          let callbacksVaSafe, callbacksVa;
          if (is64) {
            callbacksVaSafe = readUint64Safe(view, callbacksVaOffset);
            callbacksVa = callbacksVaSafe.safe ? callbacksVaSafe.value : null;
          } else {
            callbacksVa = view.getUint32(callbacksVaOffset, true);
          }

          if (callbacksVa == null) {
            // مقدار ۶۴-بیتی خارج از محدودهٔ safe-integer بود — این
            // عملیات را کاملاً و بی‌سروصدا رد می‌کنیم (item 10/12).
            result.tls.note = 'آدرس callback خارج از محدودهٔ safe-integer بود؛ تجزیه متوقف شد';
          } else if (callbacksVa > result.imageBase) {
            const callbacksRva = callbacksVa - result.imageBase;
            let arrOffset = rvaToOffset(callbacksRva, is64 ? 8 : 4);
            if (arrOffset >= 0) {
              let count = 0;
              const ptrSize = is64 ? 8 : 4;
              let unsafeEncountered = false;
              while (count < LIMITS.MAX_TLS_CALLBACKS) {
                consumeBudget(state);
                if (!inBounds(totalLen, arrOffset, ptrSize)) break;
                let ptrVal;
                if (is64) {
                  const safePtr = readUint64Safe(view, arrOffset);
                  if (!safePtr.safe) { unsafeEncountered = true; break; }
                  ptrVal = safePtr.value;
                } else {
                  ptrVal = view.getUint32(arrOffset, true);
                }
                if (ptrVal === 0) break;
                count++;
                arrOffset += ptrSize;
              }
              result.tls.callbackCount = count;
              if (unsafeEncountered) {
                result.tls.note = 'آرایهٔ callback حاوی مقداری خارج از محدودهٔ safe-integer بود؛ تجزیه در همان نقطه متوقف شد';
              }
            } else {
              result.tls.note = 'آرایهٔ callback خارج از محدودهٔ فایل است';
            }
          }
        }
      } catch (tlsErr) {
        result.tls.note = 'تجزیهٔ TLS با خطا مواجه شد؛ فقط وجود آن ثبت شد';
      }
    }

    // --- Resource Directory (ایندکس 2) — فقط حضور/اندازه/سکشن میزبان ---
    const resDir = getDataDirectory(2);
    if (resDir) {
      result.resource.present = true;
      result.resource.size = resDir.size;
      for (const sec of sections) {
        const spanSize = Math.max(sec.virtualSize, sec.rawSize);
        if (resDir.va >= sec.virtualAddress && resDir.va < sec.virtualAddress + spanSize) {
          result.resource.sectionName = sec.name;
          result.resource.entropy = sec.entropy;
          break;
        }
      }
    }

    // --- Security/Certificate Directory (ایندکس 4) — نکتهٔ مهم: VA اینجا
    // در واقع یک آفست خام فایل است، نه RVA (طبق مشخصات PE) ---
    if (actualDirectoryCount > 4) {
      const secDirOff = dataDirBase + 4 * 8;
      if (inBounds(totalLen, secDirOff, 8)) {
        const certOffset = view.getUint32(secDirOff, true);
        const certSize = view.getUint32(secDirOff + 4, true);
        if (certOffset > 0 && certSize > 0 && inBounds(totalLen, certOffset, certSize)) {
          result.security.present = true;
          result.security.size = certSize;
        }
      }
    }

    // --- تحلیل Overlay: داده‌های بعد از آخرین سکشن ---
    let maxSectionEnd = sectionTableOffset + requiredSectionTableSize;
    for (const sec of sections) {
      if (sec.rawSize > 0) {
        const end = sec.rawPointer + sec.rawSize;
        if (Number.isSafeInteger(end) && end > maxSectionEnd) maxSectionEnd = end;
      }
    }
    if (maxSectionEnd < totalLen) {
      const overlaySize = totalLen - maxSectionEnd;
      result.overlay.present = true;
      result.overlay.offset = maxSectionEnd;
      result.overlay.size = overlaySize;
      try {
        result.overlay.entropy = computeShannonEntropy(bytes.subarray(maxSectionEnd, totalLen));
      } catch (e) {
        result.overlay.entropy = null;
      }
    }

    result.valid = true;
    return result;
  } catch (err) {
    result.valid = false;
    if (err && err.code === ERROR_CODES.PARSER_LIMIT_REACHED) {
      result.reason = 'parser_limit_reached';
      result.errorCode = ERROR_CODES.PARSER_LIMIT_REACHED;
    } else {
      result.reason = 'exception: ' + String(err && err.message);
      result.errorCode = ERROR_CODES.INVALID_PE;
    }
    return result;
  }
}

/* ============================================================
   بخش ۴: تحلیل سکشن/پکر (item 28-30)
   ============================================================ */
function analyzePackerSections(peInfo, packerSetLower) {
  const findings = [];
  if (!peInfo || !peInfo.valid) return findings;

  for (const sec of peInfo.sections) {
    const nameLower = (sec.name || '').toLowerCase();
    const looksLikePacker = packerSetLower.has(nameLower);
    const execWritable = sec.executable && sec.writable;
    const highEntropySection = typeof sec.entropy === 'number' && sec.entropy > 7.2;

    if (looksLikePacker) {
      findings.push({ type: 'packer_section_name', section: sec.name,
        detail: 'نام سکشن با پکرهای شناخته‌شده (مانند UPX/Themida/VMProtect) مطابقت دارد.' });
    }
    if (execWritable) {
      findings.push({ type: 'exec_writable_section', section: sec.name,
        detail: 'سکشن هم قابل‌اجرا و هم قابل‌نوشتن است — ترکیبی غیرمعمول.' });
    }
    if (sec.executable && highEntropySection) {
      findings.push({ type: 'high_entropy_executable_section', section: sec.name,
        detail: 'سکشن قابل‌اجرا آنتروپی بسیار بالایی دارد.' });
    }
  }

  if (peInfo.entryPointSection && packerSetLower.has(peInfo.entryPointSection.toLowerCase())) {
    findings.push({ type: 'entry_point_in_packer_section', section: peInfo.entryPointSection,
      detail: 'نقطهٔ ورود برنامه داخل یک سکشن با نام مشخصهٔ پکر قرار دارد.' });
  }

  return findings;
}

/* ============================================================
   بخش ۵: اسکن رشتهٔ محدود (bounded) — ASCII و UTF-16LE (item 22-23)
   هرگز کل فایل ۶۴ مگابایتی را به یک رشتهٔ جاوااسکریپتی غول‌پیکر
   تبدیل نمی‌کنیم. برای فایل‌های بزرگ، فقط پنجرهٔ ابتدا+انتها اسکن
   می‌شود (محدودیت مستند و آگاهانه — نه پوشش کامل).
   ============================================================ */
function buildScanRegions(totalLen) {
  if (totalLen <= LIMITS.STRING_SCAN_FULL_THRESHOLD) {
    return [{ start: 0, end: totalLen }];
  }
  const head = { start: 0, end: Math.min(LIMITS.STRING_SCAN_HEAD_BYTES, totalLen) };
  const tailStart = Math.max(head.end, totalLen - LIMITS.STRING_SCAN_TAIL_BYTES);
  const tail = { start: tailStart, end: totalLen };
  return [head, tail];
}

function decodeRegionsAsciiLower(bytes, regions) {
  const decoder = new TextDecoder('latin1');
  let combined = '';
  for (const r of regions) {
    combined += decoder.decode(bytes.subarray(r.start, r.end)) + '\u0000';
  }
  return combined.toLowerCase();
}

function decodeRegionsUtf16Lower(bytes, regions) {
  const decoder = new TextDecoder('utf-16le', { fatal: false });
  let combined = '';
  for (const r of regions) {
    const len = r.end - r.start;
    const evenLen = len - (len % 2);
    if (evenLen <= 0) continue;
    combined += decoder.decode(bytes.subarray(r.start, r.start + evenLen)) + '\u0000';
  }
  return combined.toLowerCase();
}

/* ============================================================
   بخش ۶: بررسی لیست سیاه اعتبار (فقط هش، بدون وابستگی به پراکسی
   عمومی CORS) — item 19, 39-41
   ============================================================ */
async function checkHashReputation(hash) {
  const url = 'https://urlhaus-api.abuse.ch/v1/hash/';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LIMITS.NETWORK_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'hash=' + encodeURIComponent(hash),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return { status: 'unavailable', reason: 'http_' + res.status };

    let text;
    try {
      text = await res.text();
    } catch (e) {
      return { status: 'unavailable', reason: 'body_read_failed' };
    }
    if (text.length > LIMITS.MAX_REPUTATION_RESPONSE_BYTES) {
      return { status: 'unavailable', reason: 'response_too_large' };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { status: 'unavailable', reason: 'invalid_json' };
    }

    if (!data || typeof data !== 'object' || typeof data.query_status !== 'string') {
      return { status: 'unavailable', reason: 'unexpected_shape' };
    }

    if (data.query_status === 'ok') {
      return { status: 'found', data };
    }
    return { status: 'not_found', data };
  } catch (err) {
    clearTimeout(timeoutId);
    return { status: 'unavailable', reason: (err && err.name === 'AbortError') ? 'timeout' : 'network_error' };
  }
}

/* ============================================================
   بخش ۷: مدل شواهد و امتیازدهی ضدِ دوبار-شمردن (item 16, 45-46)
   ============================================================ */
function newEvidenceBucket() { return new Map(); }

function addEvidence(bucket, item) {
  const key = item.category;
  if (!bucket.has(key)) bucket.set(key, { items: [] });
  bucket.get(key).items.push(item);
}

/** حداکثر وزن یک دسته + اثر کاهش‌یافته (۰٫۴×) برای موارد تکراری همان دسته */
function summarizeCategoryScore(entry) {
  const weights = entry.items.map(i => i.weight).sort((a, b) => b - a);
  if (weights.length === 0) return 0;
  let total = weights[0];
  for (let i = 1; i < weights.length; i++) total += weights[i] * 0.4;
  return Math.round(total);
}

/* ============================================================
   بخش ۸: تابع عمومی scanFile(file) — سازگار با UI فعلی
   ============================================================ */
async function scanFile(file) {
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  function buildInvalid(reasons, errorCode, extra) {
    return Object.assign({
      ok: false,
      verdict: 'invalid',
      score: 0,
      confidence: 'high',
      hash: null,
      reasons,
      evidence: [],
      fileInfo: file ? { name: file.name, size: file.size } : null,
      scanTime: Math.round(now() - t0),
      engineVersion: ENGINE_VERSION,
      rulesVersion: _rulesCache ? _rulesCache.version : null,
      rulesStatus: _rulesCache ? _rulesCache.status : null,
      peValid: false,
      errorCode: errorCode || ERROR_CODES.SCAN_ERROR,
    }, extra || {});
  }

  if (!window.crypto || !window.crypto.subtle) {
    return buildInvalid(['برای اسکن، این صفحه باید از طریق HTTPS باز شود (Web Crypto در دسترس نیست).'], ERROR_CODES.CRYPTO_UNAVAILABLE);
  }
  if (!file || typeof file !== 'object' || typeof file.arrayBuffer !== 'function') {
    return buildInvalid(['ورودی فایل معتبر نیست.'], ERROR_CODES.READ_FAILED);
  }
  if (!Number.isFinite(file.size) || file.size <= 0) return buildInvalid(['فایل خالی است یا اندازهٔ معتبری ندارد.'], ERROR_CODES.EMPTY_FILE);
  if (file.size > LIMITS.MAX_FILE_SIZE) return buildInvalid(['فایل خیلی بزرگ است.'], ERROR_CODES.TOO_LARGE);

  // پسوند فقط محدودهٔ پشتیبانی (scope) این ابزار را مشخص می‌کند — نه اثبات
  // اینکه فایل واقعاً DLL/ASI معتبر است. اعتبار واقعی از ساختار PE می‌آید.
  const nameLower = (file.name || '').toLowerCase();
  const validExt = nameLower.endsWith('.asi') || nameLower.endsWith('.dll');
  if (!validExt) {
    return buildInvalid(['فقط فایل‌های با پسوند .asi یا .dll پشتیبانی می‌شوند.'], ERROR_CODES.INVALID_EXTENSION);
  }

  let buffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (err) {
    return buildInvalid(['خطا در خواندن محتوای فایل.'], ERROR_CODES.READ_FAILED);
  }

  if (!buffer || Object.prototype.toString.call(buffer) !== '[object ArrayBuffer]') {
    return buildInvalid(['arrayBuffer() خروجی معتبر ArrayBuffer برنگرداند.'], ERROR_CODES.READ_FAILED);
  }
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength === 0) return buildInvalid(['فایل پس از خواندن خالی بود.'], ERROR_CODES.EMPTY_FILE);
  if (bytes.byteLength > LIMITS.MAX_FILE_SIZE) return buildInvalid(['اندازهٔ واقعی بایت‌های فایل از سقف امن Engine بیشتر است.'], ERROR_CODES.TOO_LARGE);
  if (bytes.byteLength !== file.size) {
    return buildInvalid(['اندازهٔ اعلام‌شدهٔ فایل با تعداد بایت‌های خوانده‌شده یکسان نیست؛ برای جلوگیری از race/ورودی ناسازگار اسکن متوقف شد.'], ERROR_CODES.READ_SIZE_MISMATCH, {
      actualSize: bytes.byteLength,
      declaredSize: file.size,
    });
  }
  const rules = await loadRules();

  // --- v2.2.0 (item 8 از پچ): SHA-256 و بررسی اعتبار هش مستقل از
  // معتبر بودن ساختار PE محاسبه می‌شوند. یک فایل بدشکل هم می‌تواند
  // هش دقیقاً شناخته‌شده‌ای داشته باشد؛ نباید این شاهد قوی را از
  // دست بدهیم صرفاً چون تجزیهٔ PE بعداً شکست می‌خورد (item 9). ---
  let hash = null;
  try {
    hash = await computeSha256(buffer);
  } catch (err) {
    return buildInvalid(['محاسبهٔ SHA-256 ناموفق بود؛ بدون هویت محتوایی معتبر هیچ حکم SAFE صادر نمی‌شود.'], ERROR_CODES.HASH_FAILED, {
      rulesStatus: rules.status,
    });
  }
  if (!/^[a-f0-9]{64}$/.test(String(hash || ''))) {
    return buildInvalid(['SHA-256 خروجی معتبر 64 رقمی تولید نکرد؛ اسکن fail-closed متوقف شد.'], ERROR_CODES.HASH_FAILED, {
      rulesStatus: rules.status,
    });
  }

  let blacklistHit = false;
  let reputationStatus = 'not_checked';
  let reputationEvidence = null;
  const reputationReasons = [];
  if (hash) {
    const rep = await checkHashReputation(hash);
    reputationStatus = rep.status;
    if (rep.status === 'unavailable') {
      reputationReasons.push('اتصال به سرویس اعتبار ممکن نشد؛ تحلیل ایستای محلی ادامه یافت.');
    } else if (rep.status === 'found') {
      blacklistHit = true;
      reputationEvidence = {
        category: 'known_malicious_hash', rule: 'URLHAUS-BLACKLIST', severity: 'critical', weight: 60,
        confidence: 'high',
        evidence: ['هش دقیق این فایل قبلاً در پایگاه دادهٔ URLhaus به‌عنوان مخرب گزارش شده است.'],
        explanation: 'این یک تطابق هش دقیق است، نه اثبات رفتار در زمان اجرا؛ اما نشانهٔ بسیار قوی محسوب می‌شود.'
      };
      reputationReasons.push('این فایل در لیست سیاه URLhaus ثبت شده است.');
    }
  }

  // --- تجزیهٔ دفاعی PE — تعیین‌کنندهٔ اصلی INVALID بودن (نه نشانهٔ GTA) ---
  let peInfo;
  try {
    peInfo = parsePeStructure(buffer);
  } catch (err) {
    peInfo = { valid: false, reason: 'unexpected_exception', errorCode: ERROR_CODES.SCAN_ERROR };
  }

  if (!peInfo.valid) {
    const msgMap = {
      [ERROR_CODES.INVALID_MZ]: 'فایل ساختار MZ/PE معتبری ندارد.',
      [ERROR_CODES.INVALID_PE]: 'فایل ساختار PE معتبر یا قابل‌پردازش ندارد.',
      [ERROR_CODES.MALFORMED_COFF]: 'هدر COFF فایل نامعتبر یا ناقص است.',
      [ERROR_CODES.MALFORMED_OPTIONAL_HEADER]: 'Optional Header فایل نامعتبر یا ناقص است.',
      [ERROR_CODES.MALFORMED_SECTION_TABLE]: 'جدول سکشن‌های فایل ناقص یا نامعتبر است.',
      [ERROR_CODES.PARSER_LIMIT_REACHED]: 'ساختار فایل به‌قدری پیچیده/غیرعادی بود که تجزیه در محدودهٔ ایمن متوقف شد.',
    };
    const msg = msgMap[peInfo.errorCode] || 'فایل ساختار PE معتبر یا قابل‌پردازش ندارد.';

    if (blacklistHit) {
      // item 9 از پچ v2.2.0: یک هش دقیقاً شناخته‌شده به‌عنوان مخرب هرگز
      // نباید توسط یک ساختار PE نامعتبر «پاک» شود. هر دو واقعیت را
      // به‌صراحت در نتیجه نگه می‌داریم و حکم را مخرب اعلام می‌کنیم.
      return buildInvalid(
        [
          'این فایل در لیست سیاه URLhaus به‌عنوان مخرب شناخته‌شده است.',
          msg + ' (تحلیل ساختاری محدود شد، اما شاهد اعتبار همچنان معتبر و قوی است.)'
        ],
        peInfo.errorCode || ERROR_CODES.INVALID_PE,
        {
          ok: true,
          verdict: 'malicious',
          score: 0,
          confidence: 'high',
          hash,
          evidence: [reputationEvidence],
          reputationStatus,
          peValid: false,
          peErrorCode: peInfo.errorCode || ERROR_CODES.INVALID_PE,
          rulesStatus: rules.status,
        }
      );
    }

    return buildInvalid([msg], peInfo.errorCode || ERROR_CODES.INVALID_PE, {
      hash, reputationStatus, rulesStatus: rules.status,
    });
  }

  // --- از این نقطه به بعد: PE معتبر است. تحلیل کامل انجام می‌شود، صرف‌نظر
  // از اینکه نشانهٔ GTA پیدا شود یا نه (item 27) ---

  const reasons = [...reputationReasons];
  const evidenceList = [];
  const bucket = newEvidenceBucket();
  if (reputationEvidence) { addEvidence(bucket, reputationEvidence); evidenceList.push(reputationEvidence); }

  // --- شواهد ساختاری PE که خودشان امتیازدهی می‌شوند ---

  // ۱) عدم تطابق پسوند با پرچم IMAGE_FILE_DLL
  if (peInfo.isDllFlagSet === false && rules.extension_mismatch_heuristic) {
    const h = rules.extension_mismatch_heuristic;
    const ev = { category: h.category, rule: h.id, severity: h.severity, weight: h.weight,
      confidence: h.confidence, evidence: ['پرچم IMAGE_FILE_DLL در فایل تنظیم نشده، اما پسوند .dll/.asi است.'],
      explanation: h.description };
    addEvidence(bucket, ev); evidenceList.push(ev);
    reasons.push('این فایل ممکن است یک فایل اجرایی (EXE) تغییرنام‌یافته باشد، نه یک DLL/ASI واقعی.');
  }

  // ۲) ناهنجاری timestamp
  if (rules.timestamp_anomaly_heuristic && typeof peInfo.timestamp === 'number') {
    const nowUnix = Math.floor(Date.now() / 1000);
    const year1993 = 725846400;
    if (peInfo.timestamp !== 0 && (peInfo.timestamp < year1993 || peInfo.timestamp > nowUnix + 86400)) {
      const h = rules.timestamp_anomaly_heuristic;
      const ev = { category: h.category, rule: h.id, severity: h.severity, weight: h.weight,
        confidence: h.confidence, evidence: ['مهر زمانی کامپایل غیرمعمول است.'], explanation: h.description };
      addEvidence(bucket, ev); evidenceList.push(ev);
    }
  }

  // ۳) نسبت بالای ایمپورت‌های ordinal-only
  if (rules.ordinal_import_heuristic) {
    const h = rules.ordinal_import_heuristic;
    const total = peInfo.ordinalImportCount + peInfo.namedImportCount;
    if (total >= h.min_total_imports) {
      const ratio = peInfo.ordinalImportCount / total;
      if (ratio >= h.ratio_threshold) {
        const ev = { category: h.category, rule: h.id, severity: h.severity, weight: h.weight,
          confidence: h.confidence,
          evidence: ['نسبت بالای ایمپورت به‌صورت ordinal (' + Math.round(ratio * 100) + '%) که نام تابع را پنهان می‌کند.'],
          explanation: h.description };
        addEvidence(bucket, ev); evidenceList.push(ev);
      }
    }
  }

  // نکته: هش و اعتبار پیش‌تر (پیش از تجزیهٔ PE) محاسبه شدند تا حتی در
  // صورت شکست تجزیهٔ PE نیز از دست نروند (item 8/9). blacklistHit و
  // reputationStatus همان مقادیر محاسبه‌شده در بالا هستند.

  // --- اسکن رشته (محدود به پنجرهٔ ابتدا/انتها برای فایل‌های بزرگ) ---
  const regions = buildScanRegions(bytes.length);
  const asciiText = decodeRegionsAsciiLower(bytes, regions);
  let utf16Text = null; // فقط در صورت نیاز (الگوهای high/critical) محاسبه می‌شود

  const suspiciousStrings = rules.suspicious_strings || [];
  for (const rule of suspiciousStrings) {
    if (!rule.pattern) continue;
    let matched = asciiText.includes(rule.pattern);
    let viaUtf16 = false;

    if (!matched && (rule.severity === 'high' || rule.severity === 'critical')) {
      if (utf16Text === null) utf16Text = decodeRegionsUtf16Lower(bytes, regions);
      if (utf16Text.includes(rule.pattern)) { matched = true; viaUtf16 = true; }
    }

    if (matched) {
      const ev = {
        category: rule.category || 'uncategorized', rule: rule.id, severity: rule.severity,
        weight: rule.weight, confidence: rule.confidence,
        evidence: ['رشتهٔ مشکوک یافت شد: ' + rule.pattern + (viaUtf16 ? ' (به‌صورت UTF-16LE)' : '')],
        explanation: rule.description || ''
      };
      addEvidence(bucket, ev); evidenceList.push(ev);
    }
  }

  // --- آنتروپی کل فایل (شاهد ضعیف/زمینه‌ای) ---
  let fileEntropy = 0;
  try { fileEntropy = computeShannonEntropy(bytes); } catch (e) { fileEntropy = 0; }
  const entropyThreshold = typeof rules.entropy_threshold === 'number' ? rules.entropy_threshold : 7.0;
  if (fileEntropy > entropyThreshold) {
    const ev = {
      category: 'packer_artifact', rule: 'ENTROPY-WHOLE-FILE', severity: 'low', weight: 5, confidence: 'low',
      evidence: ['آنتروپی کل فایل: ' + fileEntropy.toFixed(2) + ' (آستانه: ' + entropyThreshold + ')'],
      explanation: 'آنتروپی بالا می‌تواند از فشرده‌سازی، رمزنگاری، یا داده‌های تعبیه‌شده ناشی شود؛ به‌تنهایی اثبات چیزی نیست.'
    };
    addEvidence(bucket, ev); evidenceList.push(ev);
    reasons.push('آنتروپی کل فایل بالاست (ممکن است پک‌شده/رمزشده باشد).');
  }

  // --- تحلیل سکشن/پکر ---
  const packerFindings = analyzePackerSections(peInfo, rules._packerSectionSetLower || new Set());
  if (packerFindings.length > 0) {
    const ev = {
      category: 'packer_artifact', rule: 'SECTION-PACKER-HEURISTIC', severity: 'low', weight: 6, confidence: 'medium',
      evidence: packerFindings.map(f => f.detail + (f.section ? ' (سکشن: ' + f.section + ')' : '')),
      explanation: 'الگوهای سکشن مرتبط با ابزارهای بسته‌بندی/محافظت شناسایی شد؛ این به‌تنهایی مخرب بودن را ثابت نمی‌کند.'
    };
    addEvidence(bucket, ev); evidenceList.push(ev);
    reasons.push('نشانه‌های احتمالی بسته‌بندی/محافظت (packer) در ساختار فایل یافت شد.');
  }

  // --- تحلیل ایمپورت‌ها (قابلیت‌محور، با زمینهٔ DLL) ---
  const dangerousImports = rules.dangerous_imports || [];
  const importedNameSet = new Set(
    peInfo.imports.filter(i => i.name).map(i => i.name.toLowerCase())
  );
  const importsByLowerName = new Map();
  for (const imp of peInfo.imports) {
    if (imp.name) importsByLowerName.set(imp.name.toLowerCase(), imp);
  }

  for (const capRule of dangerousImports) {
    const matchedNames = (capRule._namesLower || []).filter(n => importedNameSet.has(n));
    if (matchedNames.length > 0) {
      const withDll = matchedNames.map(n => {
        const imp = importsByLowerName.get(n);
        return imp && imp.dll ? (imp.dll + '!' + n) : n;
      });
      const ev = {
        category: capRule.category || 'uncategorized', rule: capRule.id, severity: capRule.severity,
        weight: capRule.weight, confidence: capRule.confidence,
        evidence: ['قابلیت «' + (capRule.capability || capRule.id) + '» شناسایی شد: ' + withDll.join(', ')],
        explanation: capRule.description || ''
      };
      addEvidence(bucket, ev); evidenceList.push(ev);
      if (capRule.severity === 'high' || capRule.severity === 'critical') {
        reasons.push('قابلیت پرخطر شناسایی شد: ' + (capRule.capability || capRule.id) + ' (' + withDll[0] + ')');
      }
    }
  }

  // --- نشانه‌های GTA: فقط زمینه/اطلاعات، هرگز امتیازدهی نمی‌شوند (item 27) ---
  const gtaMarkers = rules.gta_markers || [];
  const matchedMarkers = gtaMarkers.filter(m => m.pattern && asciiText.includes(m.pattern));
  const looksLikeGtaMod = matchedMarkers.length > 0;
  if (!looksLikeGtaMod) {
    reasons.push('هیچ نشانهٔ خاص GTA در فایل یافت نشد؛ این فایل ممکن است یک DLL عمومی باشد — تحلیل ایمنی همچنان کامل انجام شد.');
  }

  // --- امتیازدهی نهایی وزن‌دار + جوایز ترکیبی (anti-double-counting) ---
  let penalty = 0;
  for (const [, entry] of bucket.entries()) penalty += summarizeCategoryScore(entry);

  const matchedCategories = new Set(bucket.keys());
  const comboBonuses = [];
  for (const combo of (rules.combination_rules || [])) {
    let fired = false;

    if (combo.requires_categories) {
      // نوع الف: چند دستهٔ مستقل هم‌زمان
      const req = combo.requires_categories;
      const matchedCount = req.filter(c => matchedCategories.has(c)).length;
      fired = matchedCount >= (combo.min_categories_matched || req.length);
    } else if (combo.requires_multiple_in_category) {
      // نوع ب (جدید در v2.2.0، item 2): چند قابلیت/قانون مجزا در یک
      // دستهٔ واحد — مثلاً چند primitive مستقل تزریق فرآیند. این از
      // اتکا به «یک API» به‌عنوان مدرک کافی جلوگیری می‌کند، اما همچنان
      // یک ترکیب واقعی از چند شاهد مستقل را می‌طلبد.
      const m = combo.requires_multiple_in_category;
      const entry = bucket.get(m.category);
      if (entry) {
        const distinctRuleIds = new Set(entry.items.map(i => i.rule));
        fired = distinctRuleIds.size >= m.min_distinct_rules;
      }
    }

    if (fired) {
      penalty += combo.bonus_weight;
      comboBonuses.push(combo);
      reasons.push('ترکیب رفتاری مشکوک: ' + (combo.description || combo.name));
    }
  }

  const maxScore = typeof rules.max_score === 'number' ? rules.max_score : 100;
  let score = maxScore - penalty;
  score = Math.max(0, Math.min(100, Math.round(score)));
  if (!Number.isFinite(score)) score = 0; // محافظت نهایی در برابر NaN/Infinity

  const safeThreshold = typeof rules.safe_threshold === 'number' ? rules.safe_threshold : 80;
  const suspiciousThreshold = typeof rules.suspicious_threshold === 'number' ? rules.suspicious_threshold : 50;

  let verdict;
  if (blacklistHit) {
    verdict = 'malicious';
  } else if (score >= safeThreshold) {
    verdict = 'safe';
  } else if (score >= suspiciousThreshold) {
    verdict = 'suspicious';
  } else {
    verdict = 'malicious';
  }

  // --- v2.2.0 (item 2 از پچ — «کف ریسک»/hard-evidence floor) ---
  // یک امتیاز عددی بالا هرگز نباید یک ترکیب شاهد قوی و از‌پیش‌تعریف‌شده
  // در Rules را نادیده بگیرد. این فقط برای comboهایی اعمال می‌شود که
  // صریحاً risk_floor دارند (یعنی طراح قوانین آگاهانه آن را «شاهد قوی»
  // علامت زده)، نه برای یک API یا رشتهٔ منفرد. این تضمین می‌کند:
  //   «یک CreateRemoteThread به‌تنهایی هرگز malicious نمی‌شود»
  // اما:
  //   «سرقت اعتبار + C2، یا تخریب امنیتی + حذف بکاپ، هرگز safe نمی‌شود»
  const verdictRank = { safe: 0, suspicious: 1, malicious: 2 };
  let verdictFloorApplied = null;
  for (const combo of comboBonuses) {
    if (combo.risk_floor && verdictRank[combo.risk_floor] > verdictRank[verdict]) {
      verdict = combo.risk_floor;
      verdictFloorApplied = combo.id;
    }
  }
  if (verdictFloorApplied) {
    reasons.push('حکم بر اساس یک ترکیب شاهد قوی و از‌پیش‌تعریف‌شده تنظیم شد، نه صرفاً امتیاز عددی.');
  }

  // --- اطمینان (confidence): بر اساس تنوع دسته‌های مستقل شواهد، نه شمارش خام ---
  const independentCategories = new Set(
    [...matchedCategories].filter(c => c !== 'gta_context' && c !== 'metadata_anomaly')
  );
  const highOrCriticalCount = evidenceList.filter(e => e.severity === 'high' || e.severity === 'critical').length;

  let confidence = 'low';
  if (blacklistHit || comboBonuses.length > 0 || independentCategories.size >= 3) {
    confidence = 'high';
  } else if (independentCategories.size >= 2 || highOrCriticalCount >= 1) {
    confidence = 'medium';
  }

  // --- زبان قابل‌اعتماد برای حکم (item 60) — هرگز ادعای قطعیت ---
  const verdictLanguage = {
    safe: 'نشانهٔ مخرب قابل‌توجهی شناسایی نشد.',
    suspicious: 'نشانه‌های مشکوک شناسایی شد و بررسی بیشتر توصیه می‌شود.',
    malicious: 'نشانه‌های مخرب قوی شناسایی شد.',
  };
  reasons.unshift(verdictLanguage[verdict]);

  // --- v2.2.0 (item 3/7 از پچ): وضعیت قوانین باید صریح باشد — یک
  // اسکن با مجموعهٔ داخلی جایگزین نباید شبیه اسکن با قوانین رسمی
  // به‌نظر برسد. این خودش verdict را عوض نمی‌کند، فقط شفاف می‌کند. ---
  if (rules.status === 'fallback') {
    reasons.push('این اسکن با مجموعهٔ قوانین داخلی و حداقلی (fallback) انجام شد، نه قوانین رسمی کامل — پوشش تشخیص ممکن است کمتر باشد.');
  } else if (rules.status === 'incompatible') {
    reasons.push('rules.json بارگذاری‌شده با این نسخهٔ موتور ناسازگار بود و رد شد؛ از مجموعهٔ داخلی حداقلی استفاده شد.');
  }

  const scanTime = Math.round(now() - t0);

  return {
    ok: true,
    verdict,
    score,
    confidence,
    hash,
    reasons,
    evidence: evidenceList,
    fileInfo: { name: file.name, size: file.size },
    scanTime,
    engineVersion: ENGINE_VERSION,
    rulesVersion: rules.version || 'unknown',
    rulesStatus: rules.status || 'official',
    peValid: true,
    riskFloorApplied: verdictFloorApplied,
    peSummary: {
      is64: peInfo.is64,
      numberOfSections: peInfo.numberOfSections,
      isDllFlagSet: peInfo.isDllFlagSet,
      entryPointSection: peInfo.entryPointSection,
      namedImportCount: peInfo.namedImportCount,
      ordinalImportCount: peInfo.ordinalImportCount,
      tls: peInfo.tls,
      overlay: peInfo.overlay,
      resource: peInfo.resource,
      security: peInfo.security,
    },
    reputationStatus,
    gtaContextDetected: looksLikeGtaMod,
    disclaimer: 'این ابزار یک اسکنر ایستا (static) و اکتشافی است، نه یک آنتی‌ویروس. عدم یافتن نشانه به‌معنای تضمین قطعی امن بودن فایل نیست.'
  };
}

/* در دسترس قرار دادن API عمومی — امضای scanFile(file) و فیلدهای
   verdict/score/hash/reasons/evidence همچنان با UI فعلی سازگارند. */
window.scanFile = scanFile;
window.MalGuardEngine = Object.freeze({
  version: ENGINE_VERSION,
  rulesCompatibility: RULES_COMPATIBILITY,
  limits: Object.freeze({
    maxFileSize: LIMITS.MAX_FILE_SIZE,
    networkTimeoutMs: LIMITS.NETWORK_TIMEOUT_MS,
  }),
});
