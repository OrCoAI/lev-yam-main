/* =====================================================================
   Lev Yam — survey.js
   Conditional follow-up fields, validation, and Supabase submission
   for /survey-june.html.
   ===================================================================== */

(function () {
  const form = document.getElementById('survey-form');
  if (!form) return;

  const SUPABASE_URL = 'https://esyirbnvhchosefjozqi.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_KpN4n_dQvhBv_s7wcHAWyQ_Ur6bE0Mu';
  const supabaseClient = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  /* ── i18n: Hebrew / Arabic ────────────────────────────────────────── */
  const LANG_KEY = 'lev-yam-lang';
  const WA_OR = 'https://wa.me/972506669138?text=' +
    encodeURIComponent('שלום אור, רציתי להתייחס לסקר של חבורת לב ים');

  const translations = {
    he: {
      meta_title: 'סקר חבורת לב ים | לב ים',
      skip_link: 'דלג לתוכן הראשי',
      logo_aria: 'לב ים — דף הבית',
      lang_toggle_aria: 'שפה / اللغة',
      progress_aria: 'התקדמות במילוי הסקר',

      intro_eyebrow: 'יוני 2026',
      intro_title: 'סקר חבורת לב ים',
      intro_lead: 'חבורת לב ים גדלה, ואנחנו רוצים לדייק את המקום הזה יחד. הסקר הזה קצר, וייקח כמה דקות. הוא הצעד הראשון של הרבעון הקרוב - דרך לספר לנו מה לב ים הוא בשבילך, ומה היית רוצה לעשות בו. אין תשובות נכונות או לא נכונות. רק תשובות אמיתיות.',
      intro_meta: 'משך מילוי משוער: 4-6 דקות',

      name_label: 'שם מלא',
      name_placeholder: 'איך קוראים לך?',

      q1_text: 'מה לב ים מסמל בשבילך?',
      q2_text: 'איך הגעת לחבורת לב ים, ומה שומר אותך כאן עד היום?',
      q3_text: 'מה היית רוצה לעשות בלב ים בחודשים הקרובים?',
      hint_open_23: 'תשובה פתוחה · 2-3 משפטים',
      hint_open_1plus: 'תשובה פתוחה · משפט אחד או יותר',

      voice_divider: 'או הקלטת תשובה בקול',
      voice_record: 'הקלטת תשובה',
      voice_recording_label: 'מקליט...',
      voice_stop: 'עצירה',
      voice_done_status: 'הוקלט',
      voice_rerecord: 'הקלטה מחדש',
      voice_delete: 'מחיקה',

      q4_text: 'האם חשוב לך שיהיה יום קבוע של החבורה בלב ים?',
      q4_opt1: 'כן, חשוב לי מאוד',
      q4_opt2: 'כן, יהיה נחמד',
      q4_opt3: 'לא משנה לי',
      q4_opt4: 'לא, אני מעדיף.ה גמישות',
      q4_followup_label: 'אם ענית כן - איזה יום בשבוע הכי מתאים לך?',
      q4_followup_placeholder: 'לדוגמה: יום ראשון',

      q5_text: 'האם יש לך רעיון או יוזמה שהיית רוצה להוציא לדרך בלב ים?',
      q5_opt1: 'כן, יש לי רעיון קונקרטי',
      q5_opt2: 'יש לי משהו ראשוני, צריך לחשוב',
      q5_opt3: 'לא כרגע, אבל בעתיד אולי',
      q5_opt4: 'לא, אני כאן בשביל להיות חלק',
      q5_followup_label: 'אם יש לך רעיון - ספר.י עליו בקצרה',

      q6_text: 'האם תרצה.י לקבוע שיחה אישית עם אור?',
      q6_opt1: 'כן, יש לי משהו ספציפי לדבר עליו',
      q6_opt2: 'כן, סתם להכיר טוב יותר',
      q6_opt3: 'לא כרגע, תודה',

      closing_html: 'חבורת לב ים מבוססת על בחירה הדדית. אם זה לא הזמן או לא המקום בשבילך - זה לגיטימי לחלוטין. אפשר לכתוב ל<a href="' + WA_OR + '" target="_blank" rel="noopener">אור</a>.',
      submit_label: 'שליחת הסקר',
      submit_sending: 'שולח...',
      thankyou_title: 'הסקר נשלח',
      thankyou_text: 'תודה רבה שלקחת את הזמן. ביחד אנחנו בונים את לב ים',

      err_name: 'אנא כתבו את שמך.',
      err_q1: 'אנא כתבו תשובה או הקליטו הקלטת קול לשאלה 1.',
      err_q2: 'אנא כתבו תשובה או הקליטו הקלטת קול לשאלה 2.',
      err_q3: 'אנא כתבו תשובה או הקליטו הקלטת קול לשאלה 3.',
      err_q4: 'בחרו תשובה לשאלה 4.',
      err_q5: 'בחרו תשובה לשאלה 5.',
      err_q6: 'בחרו תשובה לשאלה 6.',
      err_q4_day: 'אנא ציינו איזה יום מתאים לך.',
      err_q5_idea: 'אנא ספרו בקצרה על הרעיון.',
      voice_err_mic: 'לא ניתן לגשת למיקרופון. אפשר גם לכתוב את התשובה בתיבת הטקסט.',
      voice_err_unsupported: 'ההקלטה אינה נתמכת בדפדפן זה. אפשר לכתוב את התשובה בתיבת הטקסט.',
      voice_err_short: 'ההקלטה הייתה קצרה מדי. נסו להקליט שוב.',
      voice_err_generic: 'אירעה תקלה בהקלטה. נסו שוב או כתבו את התשובה.',
      submit_no_client: 'לא ניתן להתחבר לשירות השמירה. בדקו את החיבור לאינטרנט ונסו שוב.',
      submit_failed: 'משהו השתבש בשליחה. בדקו את החיבור לאינטרנט ונסו שוב, או כתבו לנו בוואטסאפ.',

      brand: 'לב ים',
      footer_tagline: 'מרחב יזמות עסקית חברתית על קו המים',
      footer_phone_aria: 'התקשרו ללב ים',
      footer_email_aria: 'שלחו מייל ללב ים',
      footer_wa_aria: 'וואטסאפ לב ים',
      footer_ig_aria: 'אינסטגרם לב ים',
      footer_fb_aria: 'פייסבוק לב ים',
      footer_map_aria: 'מיקום לב ים',
      footer_credit_html: '© לב ים <bdi>2026</bdi>'
    },
    ar: {
      meta_title: 'استبيان جماعة ليف يام | ليف يام',
      skip_link: 'تخطَّ إلى المحتوى الرئيسي',
      logo_aria: 'ليف يام — الصفحة الرئيسية',
      lang_toggle_aria: 'اللغة / שפה',
      progress_aria: 'التقدّم في تعبئة الاستبيان',

      intro_eyebrow: 'يونيو 2026',
      intro_title: 'استبيان جماعة ليف يام',
      intro_lead: 'جماعة ليف يام عم تكبر، وإحنا بدنا نضبط هالمكان سوا. هالاستبيان قصير، وبياخذ كم دقيقة. هو الخطوة الأولى للربع الجاي - طريقة تحكيلنا شو يعني إلك ليف يام، وشو بتحب تعمل فيه. ما في إجابات صح أو غلط. بس إجابات حقيقية.',
      intro_meta: 'مدة التعبئة التقديرية: 4-6 دقائق',

      name_label: 'الاسم الكامل',
      name_placeholder: 'شو اسمك؟',

      q1_text: 'شو بيرمز إلك ليف يام؟',
      q2_text: 'كيف وصلت لجماعة ليف يام، وشو اللي بيخلّيك تضلّ هون لليوم؟',
      q3_text: 'شو بتحب تعمل في ليف يام بالشهور الجاية؟',
      hint_open_23: 'إجابة مفتوحة · جملتين أو ثلاث',
      hint_open_1plus: 'إجابة مفتوحة · جملة واحدة أو أكثر',

      voice_divider: 'أو سجّل إجابتك صوتيًا',
      voice_record: 'تسجيل إجابة',
      voice_recording_label: 'عم يسجّل...',
      voice_stop: 'إيقاف',
      voice_done_status: 'تمّ التسجيل',
      voice_rerecord: 'تسجيل من جديد',
      voice_delete: 'حذف',

      q4_text: 'بيهمّك يكون في يوم ثابت للجماعة في ليف يام؟',
      q4_opt1: 'أكيد، بيهمّني كتير',
      q4_opt2: 'آه، بكون حلو',
      q4_opt3: 'ما بيفرق معي',
      q4_opt4: 'لأ، بفضّل المرونة',
      q4_followup_label: 'إذا جاوبت آه - أي يوم بالأسبوع بناسبك أكتر؟',
      q4_followup_placeholder: 'مثلًا: يوم الأحد',

      q5_text: 'عندك فكرة أو مبادرة بتحب تطلّعها لحيّز التنفيذ في ليف يام؟',
      q5_opt1: 'آه، عندي فكرة واضحة',
      q5_opt2: 'عندي شي أوّلي، بدّو تفكير',
      q5_opt3: 'مش هلأ، بس بالمستقبل يمكن',
      q5_opt4: 'لأ، أنا هون لأكون جزء',
      q5_followup_label: 'إذا عندك فكرة - احكيلنا عنها باختصار',

      q6_text: 'بتحب تحدّد مكالمة شخصية مع أور؟',
      q6_opt1: 'آه، عندي شي محدّد بدّي أحكي عنه',
      q6_opt2: 'آه، بس لنتعرّف أكتر',
      q6_opt3: 'مش هلأ، شكرًا',

      closing_html: 'جماعة ليف يام مبنية على اختيار متبادل. إذا مش هلأ الوقت أو مش هون المكان إلك - هذا شي شرعي تمامًا. بتقدر تكتب لـ<a href="' + WA_OR + '" target="_blank" rel="noopener">أور</a>.',
      submit_label: 'إرسال الاستبيان',
      submit_sending: 'عم يرسل...',
      thankyou_title: 'تمّ إرسال الاستبيان',
      thankyou_text: 'شكرًا كتير إنك أخذت من وقتك. سوا عم نبني ليف يام',

      err_name: 'الرجاء كتابة اسمك.',
      err_q1: 'الرجاء كتابة إجابة أو تسجيل إجابة صوتية للسؤال 1.',
      err_q2: 'الرجاء كتابة إجابة أو تسجيل إجابة صوتية للسؤال 2.',
      err_q3: 'الرجاء كتابة إجابة أو تسجيل إجابة صوتية للسؤال 3.',
      err_q4: 'اختر إجابة للسؤال 4.',
      err_q5: 'اختر إجابة للسؤال 5.',
      err_q6: 'اختر إجابة للسؤال 6.',
      err_q4_day: 'الرجاء تحديد أي يوم بناسبك.',
      err_q5_idea: 'الرجاء الحديث باختصار عن الفكرة.',
      voice_err_mic: 'ما قدرنا نوصل للمايكروفون. بتقدر تكتب إجابتك بصندوق النص.',
      voice_err_unsupported: 'التسجيل مش مدعوم بهالمتصفّح. بتقدر تكتب إجابتك بصندوق النص.',
      voice_err_short: 'التسجيل كان قصير كتير. جرّب تسجّل من جديد.',
      voice_err_generic: 'صار خلل بالتسجيل. جرّب من جديد أو اكتب الإجابة.',
      submit_no_client: 'ما قدرنا نتّصل بخدمة الحفظ. تأكّد من اتصالك بالإنترنت وجرّب من جديد.',
      submit_failed: 'صار خلل بالإرسال. تأكّد من اتصالك بالإنترنت وجرّب من جديد، أو اكتبلنا على واتساب.',

      brand: 'ليف يام',
      footer_tagline: 'فضاء لريادة الأعمال الاجتماعية على خط الماء',
      footer_phone_aria: 'اتّصلوا بليف يام',
      footer_email_aria: 'أرسلوا بريدًا إلى ليف يام',
      footer_wa_aria: 'واتساب ليف يام',
      footer_ig_aria: 'إنستغرام ليف يام',
      footer_fb_aria: 'فيسبوك ليف يام',
      footer_map_aria: 'موقع ليف يام',
      footer_credit_html: '© ليف يام <bdi>2026</bdi>'
    }
  };

  let currentLang = 'he';
  try {
    if (localStorage.getItem(LANG_KEY) === 'ar') currentLang = 'ar';
  } catch (e) { /* localStorage blocked */ }

  function t(key) {
    const dict = translations[currentLang] || translations.he;
    if (dict[key] != null) return dict[key];
    return translations.he[key] != null ? translations.he[key] : '';
  }

  function applyTranslations() {
    const dict = translations[currentLang] || translations.he;
    document.documentElement.lang = currentLang;
    if (dict.meta_title) document.title = dict.meta_title;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      if (dict[key] != null) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-html');
      if (dict[key] != null) el.innerHTML = dict[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key] != null) el.setAttribute('placeholder', dict[key]);
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-aria-label');
      if (dict[key] != null) el.setAttribute('aria-label', dict[key]);
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-alt');
      if (dict[key] != null) el.setAttribute('alt', dict[key]);
    });

    document.querySelectorAll('.lang-toggle [data-lang-set]').forEach(function (opt) {
      const isActive = opt.getAttribute('data-lang-set') === currentLang;
      opt.classList.toggle('is-active', isActive);
      opt.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function setLang(lang) {
    if (lang !== 'he' && lang !== 'ar') return;
    if (lang === currentLang) return;
    currentLang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    applyTranslations();
  }

  document.addEventListener('click', function (e) {
    const opt = e.target.closest && e.target.closest('.lang-toggle [data-lang-set]');
    if (!opt) return;
    e.preventDefault();
    setLang(opt.getAttribute('data-lang-set'));
  });

  function extensionForMimeType(mimeType) {
    if (!mimeType) return 'webm';
    if (mimeType.indexOf('mp4') !== -1 || mimeType.indexOf('m4a') !== -1) return 'm4a';
    if (mimeType.indexOf('ogg') !== -1) return 'ogg';
    return 'webm';
  }

  // Pick a recording format the current browser actually supports.
  // iOS Safari only does audio/mp4; Android/desktop Chrome prefer webm/opus.
  function pickSupportedMimeType() {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
    }
    return '';
  }

  async function uploadVoiceNote(responseId, qid, blob) {
    const ext = extensionForMimeType(blob.type);
    const path = responseId + '/' + qid + '.' + ext;
    const { error: uploadError } = await supabaseClient.storage
      .from('voice-notes')
      .upload(path, blob, { contentType: blob.type || 'audio/webm' });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabaseClient.storage.from('voice-notes').getPublicUrl(path);
    return urlData.publicUrl;
  }

  function clearError(container) {
    if (container) container.classList.remove('is-invalid');
  }

  function setError(container, message) {
    if (!container) return;
    container.classList.add('is-invalid');
    let errorEl = container.querySelector('.q-error');
    if (!errorEl) {
      errorEl = document.createElement('p');
      errorEl.className = 'q-error';
      errorEl.setAttribute('role', 'alert');
      container.appendChild(errorEl);
    }
    errorEl.textContent = message;
  }

  function isVisible(el) {
    return !!el && !el.hidden;
  }

  /* ── Voice note recording (Q1-Q3 alternative answer) ──────────────── */
  const voiceAnswers = { q1: null, q2: null, q3: null };
  const voiceSupported = !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  let stopActiveRecording = null;

  function formatTimer(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return minutes + ':' + seconds;
  }

  function setupVoiceQuestion(container) {
    const qid = container.dataset.voiceFor;
    const idleEl = container.querySelector('.q-voice-idle');
    const recordingEl = container.querySelector('.q-voice-recording');
    const doneEl = container.querySelector('.q-voice-done');
    const errorEl = container.querySelector('.q-voice-error');
    const recordBtn = container.querySelector('.q-voice-record-btn');
    const stopBtn = container.querySelector('.q-voice-stop-btn');
    const rerecordBtn = container.querySelector('.q-voice-rerecord-btn');
    const deleteBtn = container.querySelector('.q-voice-delete-btn');
    const timerEl = container.querySelector('.q-voice-timer');
    const audioEl = container.querySelector('.q-voice-audio');

    let mediaRecorder = null;
    let mediaStream = null;
    let chunks = [];
    let timerInterval = null;
    let startTime = 0;
    let objectUrl = null;

    function showState(state) {
      idleEl.hidden = state !== 'idle';
      recordingEl.hidden = state !== 'recording';
      doneEl.hidden = state !== 'done';
    }

    function showVoiceError(message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }

    function releaseStream() {
      if (mediaStream) {
        mediaStream.getTracks().forEach(function (track) { track.stop(); });
        mediaStream = null;
      }
    }

    function resetTimer() {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }

    function stopRecording() {
      resetTimer();
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    }

    async function startRecording() {
      if (recordBtn.disabled) return;
      recordBtn.disabled = true;
      errorEl.hidden = true;
      resetTimer();
      timerEl.textContent = '00:00';
      showState('recording');
      if (stopActiveRecording && stopActiveRecording !== stopRecording) {
        stopActiveRecording();
      }

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        recordBtn.disabled = false;
        showState('idle');
        showVoiceError(t('voice_err_mic'));
        return;
      }

      chunks = [];
      try {
        const mimeType = pickSupportedMimeType();
        mediaRecorder = mimeType
          ? new MediaRecorder(mediaStream, { mimeType: mimeType })
          : new MediaRecorder(mediaStream);
      } catch (err) {
        recordBtn.disabled = false;
        showState('idle');
        showVoiceError(t('voice_err_unsupported'));
        releaseStream();
        return;
      }

      mediaRecorder.addEventListener('dataavailable', function (event) {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      });

      mediaRecorder.addEventListener('error', function () {
        resetTimer();
        releaseStream();
        recordBtn.disabled = false;
        showState('idle');
        showVoiceError(t('voice_err_generic'));
      });

      mediaRecorder.addEventListener('stop', function () {
        releaseStream();
        resetTimer();
        if (stopActiveRecording === stopRecording) stopActiveRecording = null;

        const hasAudio = chunks.some(function (chunk) { return chunk.size > 0; });
        if (!hasAudio) {
          recordBtn.disabled = false;
          showState('idle');
          showVoiceError(t('voice_err_short'));
          return;
        }

        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        voiceAnswers[qid] = blob;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(blob);
        audioEl.src = objectUrl;
        showState('done');
        clearError(container.closest('.survey-q'));
        updateProgress();
      });

      mediaRecorder.start();
      startTime = Date.now();
      timerInterval = setInterval(function () {
        timerEl.textContent = formatTimer(Date.now() - startTime);
      }, 250);
      stopActiveRecording = stopRecording;
    }

    function deleteRecording() {
      resetTimer();
      voiceAnswers[qid] = null;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      audioEl.removeAttribute('src');
      audioEl.load();
      recordBtn.disabled = false;
      showState('idle');
      updateProgress();
    }

    recordBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);
    deleteBtn.addEventListener('click', function () {
      stopRecording();
      deleteRecording();
    });
    rerecordBtn.addEventListener('click', function () {
      stopRecording();
      deleteRecording();
      startRecording();
    });
  }

  const voiceContainers = form.querySelectorAll('.q-voice');
  if (voiceSupported) {
    voiceContainers.forEach(setupVoiceQuestion);
  } else {
    voiceContainers.forEach(function (container) { container.hidden = true; });
  }

  // Release the mic if the user backgrounds or leaves the page mid-recording.
  window.addEventListener('pagehide', function () {
    if (stopActiveRecording) stopActiveRecording();
  });

  /* ── Conditional follow-ups (Q4, Q5) ──────────────────────────────── */
  form.querySelectorAll('[data-conditional-group]').forEach(function (group) {
    const radios = group.querySelectorAll('input[type="radio"]');
    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        group.querySelectorAll('.q-followup').forEach(function (followup) {
          followup.hidden = true;
        });
        if (radio.checked && radio.dataset.reveals) {
          const target = document.getElementById(radio.dataset.reveals);
          if (target) target.hidden = false;
        }
        clearError(group);
      });
    });
  });

  /* ── Progress bar ─────────────────────────────────────────────────── */
  const progressBar = document.querySelector('.survey-progress');
  const progressFill = document.getElementById('survey-progress-fill');

  function updateProgress() {
    if (!progressFill) return;
    let done = 0;
    const total = 7;

    if (document.getElementById('respondent-name').value.trim()) done++;
    ['q1', 'q2', 'q3'].forEach(function (id) {
      if (document.getElementById(id).value.trim() || voiceAnswers[id]) done++;
    });
    ['q4', 'q5', 'q6'].forEach(function (name) {
      if (form.querySelector('input[name="' + name + '"]:checked')) done++;
    });

    const pct = Math.round((done / total) * 100);
    progressFill.style.width = pct + '%';
    if (progressBar) progressBar.setAttribute('aria-valuenow', String(pct));
  }

  form.addEventListener('input', updateProgress);
  form.addEventListener('change', updateProgress);

  /* ── Validation + submit ──────────────────────────────────────────── */
  const submitBtn = document.getElementById('survey-submit-btn');
  const submitLabel = submitBtn.querySelector('.survey-submit-label');
  const submitErrorEl = document.getElementById('survey-submit-error');

  function showSubmitError(message) {
    submitErrorEl.textContent = message;
    submitErrorEl.hidden = false;
  }

  function hideSubmitError() {
    submitErrorEl.hidden = true;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    let firstInvalid = null;
    const data = {};

    const nameField = document.getElementById('respondent-name');
    const nameContainer = nameField.closest('.survey-q');
    const nameValue = nameField.value.trim();
    if (!nameValue) {
      setError(nameContainer, t('err_name'));
      firstInvalid = nameField;
    } else {
      clearError(nameContainer);
    }
    data.name = nameValue;

    ['q1', 'q2', 'q3'].forEach(function (id) {
      const field = document.getElementById(id);
      const container = field.closest('.survey-q');
      const value = field.value.trim();
      const voiceBlob = voiceAnswers[id];
      if (!value && !voiceBlob) {
        setError(container, t('err_' + id));
        if (!firstInvalid) firstInvalid = field;
      } else {
        clearError(container);
      }
      data[id] = value;
    });

    ['q4', 'q5', 'q6'].forEach(function (name) {
      const checked = form.querySelector('input[name="' + name + '"]:checked');
      const container = form.querySelector('[data-conditional-group="' + name + '"]');
      if (!checked) {
        setError(container, t('err_' + name));
        if (!firstInvalid) firstInvalid = form.querySelector('input[name="' + name + '"]');
      } else {
        clearError(container);
      }
      data[name] = checked ? checked.value : '';
    });

    const q4Followup = document.getElementById('q4-followup');
    const q4Day = document.getElementById('q4-day');
    if (isVisible(q4Followup)) {
      const value = q4Day.value.trim();
      if (!value) {
        setError(q4Followup.closest('.survey-q'), t('err_q4_day'));
        if (!firstInvalid) firstInvalid = q4Day;
      }
      data.q4_day = value;
    } else {
      data.q4_day = '';
    }

    const q5Followup = document.getElementById('q5-followup');
    const q5Idea = document.getElementById('q5-idea');
    if (isVisible(q5Followup)) {
      const value = q5Idea.value.trim();
      if (!value) {
        setError(q5Followup.closest('.survey-q'), t('err_q5_idea'));
        if (!firstInvalid) firstInvalid = q5Idea;
      }
      data.q5_idea = value;
    } else {
      data.q5_idea = '';
    }

    if (firstInvalid) {
      firstInvalid.focus();
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!supabaseClient) {
      showSubmitError(t('submit_no_client'));
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
    submitLabel.textContent = t('submit_sending');
    hideSubmitError();

    try {
      const responseId = (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : Date.now() + '-' + Math.random().toString(16).slice(2);

      const voiceUrls = {};
      for (const id of ['q1', 'q2', 'q3']) {
        const blob = voiceAnswers[id];
        if (blob) {
          voiceUrls[id] = await uploadVoiceNote(responseId, id, blob);
        }
      }

      const { error: insertError } = await supabaseClient.from('survey_responses').insert([{
        name: data.name,
        q1: data.q1,
        q1_voice_url: voiceUrls.q1 || null,
        q2: data.q2,
        q2_voice_url: voiceUrls.q2 || null,
        q3: data.q3,
        q3_voice_url: voiceUrls.q3 || null,
        q4: data.q4,
        q4_day: data.q4_day,
        q5: data.q5,
        q5_idea: data.q5_idea,
        q6: data.q6
      }]);
      if (insertError) throw insertError;

      form.hidden = true;
      const thankyou = document.getElementById('survey-thankyou');
      thankyou.hidden = false;
      thankyou.focus();
      thankyou.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error('Survey submission failed:', err);
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
      submitLabel.textContent = t('submit_label');
      showSubmitError(t('submit_failed'));
    }
  });

  /* ── Apply translations on load ───────────────────────────────────── */
  applyTranslations();
})();
