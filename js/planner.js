'use strict';

/* ── Homepage WhatsApp planner ──────────────────────────────────────────────
   Replaces the four "what would you like to do?" WhatsApp buttons in #contact
   with a short flow: who are you → how many → when, one tap each, writing the
   WhatsApp message as it goes. No form, no backend, nothing stored.

   Without this script the buttons stay what they were: plain WhatsApp links.
   With it, each becomes the first answer of the flow. "Join" and "weekends"
   need no planning: they go straight to the ready message.

   Loaded after js/app.js (it reads LevYamI18n for the language and for the
   opening sentence of each path — the same `wa_msg_*` strings the buttons
   used). The size and month strings are the business page's (js/business.js).

   Analytics: the send link is an ordinary wa.me link, so js/app.js's click
   handler fans it out (GA4 whatsapp_click, Meta Contact, Dynatrace
   whatsapp_cta) with source `planner_<path>`. The flow's own steps go to
   Dynatrace only (ADR 0006): levyam.contact_intent keeps the series the old
   buttons fed, levyam.planner_step is new.                                   */

(function () {
  const root = document.querySelector('[data-planner]');
  if (!root || typeof LevYamI18n === 'undefined') return;

  const WA = 'https://wa.me/972506669138?text=';

  // Each path: its opening sentence (app.js dictionary), the contact_intent
  // value the old button reported, and the questions that follow.
  const PATHS = {
    team:   { msg: 'wa_msg_team',   intent: 'team',  steps: ['size', 'when'] },
    priv:   { msg: 'wa_msg_family', intent: 'priv',  steps: ['size', 'when'] },
    dream:  { msg: 'wa_msg_dream',  intent: 'dream', steps: ['size', 'when'] },
    join:   { msg: 'wa_msg_join',   intent: 'join',  steps: [] },
    week:   { msg: 'wa_msg_week',   intent: 'week',  steps: [] }
  };
  const SIZES = ['lt15', '15-30', '30-50', '50plus'];

  const STR = {
    he: {
      q_size: 'כמה אנשים אתם?',
      q_when: 'מתי תרצו להגיע?',
      'size-lt15': 'עד 15 אנשים',
      'size-15-30': '15-30 אנשים',
      'size-30-50': '30-50 אנשים',
      'size-50plus': 'מעל 50 אנשים',
      when_month: 'ב{month}',
      when_later: 'מאוחר יותר',
      when_later_msg: 'בעוד חצי שנה או יותר',
      when_open: 'עוד לא סגרנו תאריך',
      back: 'חזרה',
      skip: 'דלגו',
      restart: 'מתחילים מחדש',
      ready: 'ההודעה מוכנה!',
      ready_sub: 'עוד לחיצה אחת ואנחנו מדברים בוואטסאפ.',
      label: 'ההודעה שלכם',
      send: 'שלחו בוואטסאפ',
      note: 'זו ההודעה שתישלח. אפשר לערוך אותה בוואטסאפ לפני השליחה.',
      business: 'לכל הפרטים על אירועים עסקיים'
    },
    ar: {
      q_size: 'كم عددكم؟',
      q_when: 'متى تودّون القدوم؟',
      'size-lt15': 'حتى 15 شخصاً',
      'size-15-30': '15-30 شخصاً',
      'size-30-50': '30-50 شخصاً',
      'size-50plus': 'أكثر من 50 شخصاً',
      when_month: 'في شهر {month}',
      when_later: 'لاحقاً',
      when_later_msg: 'بعد نصف سنة أو أكثر',
      when_open: 'لم نحدد موعداً بعد',
      back: 'رجوع',
      skip: 'تخطّي',
      restart: 'البدء من جديد',
      ready: 'الرسالة جاهزة!',
      ready_sub: 'نقرة واحدة ونتحدث عبر واتساب.',
      label: 'رسالتكم',
      send: 'أرسلوا عبر واتساب',
      note: 'هذه هي الرسالة التي ستُرسل. يمكن تعديلها في واتساب قبل الإرسال.',
      business: 'كل التفاصيل عن فعاليات الأعمال'
    }
  };

  const state = { path: null, size: null, when: null, step: 0 };

  function lang() { return LevYamI18n.lang === 'ar' ? 'ar' : 'he'; }
  function s(key) { return STR[lang()][key] || STR.he[key] || ''; }

  function bizEvent(type, attrs) {
    try {
      if (window.LevYamTrack) window.LevYamTrack.bizEvent(type, attrs);
    } catch (e) { /* telemetry is additive, never load-bearing */ }
  }

  /* ── The message ────────────────────────────────────────────────────── */
  function monthName(value) {
    const parts = value.split('-').map(Number);
    return new Intl.DateTimeFormat(lang(), { month: 'long' }).format(new Date(parts[0], parts[1] - 1, 1));
  }

  function whenText() {
    if (!state.when) return null;
    if (state.when === 'open') return s('when_open');
    if (state.when === 'later') return s('when_later_msg');
    const year = Number(state.when.slice(0, 4));
    const month = year === new Date().getFullYear() ? monthName(state.when) : monthName(state.when) + ' ' + year;
    return s('when_month').replace('{month}', month);
  }

  // "<opening sentence>. <size>, <when>." — the opening is the old button's text.
  function message() {
    const path = PATHS[state.path];
    const base = LevYamI18n.t(path ? path.msg : 'wa_msg_general');
    const extra = [state.size ? s('size-' + state.size) : null, whenText()].filter(Boolean);
    return extra.length ? base + '. ' + extra.join(lang() === 'ar' ? '، ' : ', ') + '.' : base;
  }

  // A range of numbers reads left to right: "15-30". Hebrew text keeps it so
  // on its own. Arabic text swaps the two numbers ("30-15"), and so does any
  // right-to-left line once the hyphen is the non-breaking one - unless the
  // range is isolated (U+2066 … U+2069: invisible, honoured by every current
  // browser and by WhatsApp).
  function ltrRanges(text, hyphen) {
    return text.replace(/(\d+)-(\d+)/g, '\u2066$1' + (hyphen || '-') + '$2\u2069');
  }
  function forLang(text) { return lang() === 'ar' ? ltrRanges(text) : text; }

  /* ── DOM ────────────────────────────────────────────────────────────── */
  const question = root.querySelector('.contact-intro');
  const firstStep = root.querySelector('.contact-buttons');
  const openingQuestionKey = question.getAttribute('data-i18n');

  // The buttons stop being WhatsApp links: no href to wa.me (so the site's
  // click handler does not count a tap on them as a WhatsApp click) and no
  // data-i18n-wa (so a language switch does not write the href back).
  firstStep.querySelectorAll('[data-plan]').forEach(function (a) {
    a.removeAttribute('data-i18n-wa');
    a.removeAttribute('target');
    a.removeAttribute('rel');
    a.setAttribute('href', '#contact');
    a.setAttribute('role', 'button');
  });

  const top = document.createElement('div');
  top.className = 'planner-top';
  top.hidden = true;
  top.innerHTML = '<button type="button" class="planner-link" data-act="back"></button>' +
                  '<span class="planner-dots" aria-hidden="true"></span>' +
                  '<button type="button" class="planner-link" data-act="skip"></button>';
  root.insertBefore(top, question);

  const choices = document.createElement('div');
  choices.className = 'planner-choices';
  choices.hidden = true;
  root.appendChild(choices);

  const panel = document.createElement('div');
  panel.className = 'planner-panel';
  panel.hidden = true;
  panel.innerHTML =
    '<p class="planner-ready" hidden><strong></strong><span></span></p>' +
    '<p class="planner-label"></p>' +
    '<p class="planner-msg" aria-live="polite"></p>' +
    '<a class="btn btn-primary planner-send" target="_blank" rel="noopener"></a>' +
    '<p class="planner-note"></p>' +
    '<a class="planner-business" href="/business/" data-business-source="planner" hidden></a>' +
    '<button type="button" class="planner-link planner-restart" data-act="restart"></button>';
  root.appendChild(panel);

  const backBtn = top.querySelector('[data-act="back"]');
  const skipBtn = top.querySelector('[data-act="skip"]');
  const dots = top.querySelector('.planner-dots');
  const send = panel.querySelector('.planner-send');

  function monthsAhead() {
    const out = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }
    return out;
  }

  function choice(group, value, label) {
    const pressed = state[group] === value;
    return '<button type="button" class="planner-choice" data-group="' + group + '" data-value="' + value +
           '" aria-pressed="' + pressed + '"><bdi>' + forLang(label) + '</bdi></button>';
  }

  function render() {
    const path = PATHS[state.path];
    const steps = path ? path.steps : [];
    const kind = path ? steps[state.step] : null;      // 'size' | 'when' | undefined (= ready)
    const started = Boolean(path);
    const ready = started && !kind;

    firstStep.hidden = started;
    top.hidden = !started;
    choices.hidden = !kind;
    panel.hidden = !started;

    backBtn.textContent = s('back');
    skipBtn.textContent = s('skip');
    skipBtn.hidden = !kind;
    // progress: every answered question stays lit (all of them on the ready screen)
    dots.innerHTML = steps.map(function (_, i) {
      return '<i' + (i <= state.step || ready ? ' class="is-on"' : '') + '></i>';
    }).join('');

    if (!started) {
      question.hidden = false;
      question.setAttribute('data-i18n', openingQuestionKey);
      question.textContent = LevYamI18n.t(openingQuestionKey);
    } else if (kind) {
      question.hidden = false;
      question.removeAttribute('data-i18n');             // app.js must not overwrite the step's question
      question.textContent = s(kind === 'size' ? 'q_size' : 'q_when');
    } else {
      question.hidden = true;
    }

    if (kind === 'size') {
      choices.className = 'planner-choices';
      choices.innerHTML = SIZES.map(function (v) { return choice('size', v, s('size-' + v)); }).join('');
    } else if (kind === 'when') {
      choices.className = 'planner-choices planner-choices--when';
      choices.innerHTML = monthsAhead().map(function (v) { return choice('when', v, monthName(v)); }).join('') +
        choice('when', 'later', s('when_later')) + choice('when', 'open', s('when_open'));
    } else {
      choices.innerHTML = '';
    }

    const readyBox = panel.querySelector('.planner-ready');
    readyBox.hidden = !ready;
    readyBox.querySelector('strong').textContent = s('ready');
    readyBox.querySelector('span').textContent = s('ready_sub');
    panel.querySelector('.planner-label').textContent = s('label');
    // in the preview only: a non-breaking hyphen, so "15-30" never splits across lines
    panel.querySelector('.planner-msg').textContent = ltrRanges(message(), '\u2011');
    // The note, the business link and "start over" belong to the ready screen;
    // while a question is open they only pushed the answers off a phone.
    const note = panel.querySelector('.planner-note');
    note.hidden = !ready;
    note.textContent = s('note');
    const restart = panel.querySelector('.planner-restart');
    restart.hidden = !ready;
    restart.textContent = s('restart');
    const business = panel.querySelector('.planner-business');
    business.hidden = !ready || state.path !== 'team';
    business.textContent = s('business');
    send.textContent = s('send');
    send.classList.toggle('is-ready', ready);
    send.setAttribute('href', WA + encodeURIComponent(forLang(message())));
    send.setAttribute('data-bizevent-source', 'planner_' + (state.path || 'general'));
  }

  function go(step, via) {
    bizEvent('levyam.planner_step', {
      'planner.path': state.path || '',
      'planner.from': state.step,
      'planner.to':   step,
      'planner.via':  via,
      'event.lang':   lang()
    });
    state.step = step;
    render();
    const focusTarget = choices.hidden ? send : choices.querySelector('button');
    if (focusTarget) focusTarget.focus({ preventScroll: true });
    bringIntoView();
  }

  // Each step replaces the one before it, so the planner's height changes under
  // the visitor's thumb. Keep its top just under the stuck header whenever it
  // has drifted off: the question - or the ready message and its send button -
  // is then always on screen.
  function bringIntoView() {
    const top = root.getBoundingClientRect().top;
    // the stuck header and its air: html's scroll-padding-top (css/styles.css)
    const under = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    if (top >= under - 8 && top <= window.innerHeight * 0.25) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' });
  }

  function startOver(path) {
    state.path = path;
    state.size = null;
    state.when = null;
  }

  root.addEventListener('click', function (e) {
    const start = e.target.closest('[data-plan]');
    if (start && firstStep.contains(start)) {
      e.preventDefault();
      startOver(start.getAttribute('data-plan'));
      bizEvent('levyam.contact_intent', { 'intent.type': PATHS[state.path].intent, 'event.lang': lang() });
      go(0, 'choice');
      return;
    }

    const pick = e.target.closest('.planner-choice');
    if (pick) {
      state[pick.getAttribute('data-group')] = pick.getAttribute('data-value');
      go(state.step + 1, 'choice');
      return;
    }

    const act = e.target.closest('[data-act]');
    if (!act) return;
    const what = act.getAttribute('data-act');
    if (what === 'skip') {
      // skipping drops an answer given to this question earlier: the message says only what was chosen
      const kind = PATHS[state.path].steps[state.step];
      if (kind) state[kind] = null;
      go(state.step + 1, 'skip');
    } else if (what === 'back' && state.step > 0) {
      go(state.step - 1, 'back');
    } else {                                             // back from the first question, or restart
      const chosen = what === 'back' ? state.path : null;
      startOver(null);
      state.step = 0;
      render();
      // back: the keyboard returns to the answer it came from; restart: to the first one
      const target = (chosen && firstStep.querySelector('[data-plan="' + chosen + '"]')) || firstStep.querySelector('[data-plan]');
      if (target) target.focus({ preventScroll: true });
    }
  });

  // The first answers are links dressed as buttons (so they still work without
  // this script): a button answers to Space as well as Enter.
  firstStep.addEventListener('keydown', function (e) {
    if (e.key !== ' ' && e.key !== 'Spacebar') return;
    const row = e.target.closest('[data-plan]');
    if (!row) return;
    e.preventDefault();
    row.click();
  });

  document.addEventListener('langchange', render);
  root.classList.add('is-live');
  render();
})();
