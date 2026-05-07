'use strict';

/* ── i18n: Hebrew / Arabic toggle ─────────────────────────────────────── */
/*  Arabic is written for the Levantine/Palestinian context spoken in Israel —
    clear, accessible language with conversational tone in body copy and
    tighter, MSA-leaning phrasing for headings and labels.                  */
const LevYamI18n = (function () {
  const STORAGE_KEY = 'lev-yam-lang';
  const PHONE = '972506669138';

  const translations = {
    he: {
      meta_title: 'לב ים | מרחב יזמות עסקית חברתית על קו המים',
      meta_desc: 'מרחב ליזמות עסקית חברתית המבוסס על שותפות, פשטות וקבלה.',
      og_locale: 'he_IL',

      brand: 'לב ים',
      skip_link: 'דלג לתוכן הראשי',

      logo_aria: 'לב ים — דף הבית',
      nav_main_aria: 'תפריט ראשי',
      nav_services: 'מה קורה בלב ים',
      nav_why: 'למה לב ים',
      nav_gallery: 'גלריה',
      nav_faq: 'שאלות ותשובות',
      nav_contact: 'צור קשר',

      nav_open: 'פתיחת תפריט',
      nav_close: 'סגירת תפריט',
      mobile_nav_aria: 'תפריט נייד',
      mobile_nav_close: 'סגור תפריט',

      lang_toggle_aria: 'שפה / اللغة',

      social_wa_aria: 'לב ים בוואטסאפ',
      social_email_aria: 'שלחו אימייל ללב ים',
      social_map_aria: 'נווט ללב ים במפות',
      social_ig_aria: 'לב ים באינסטגרם',
      social_fb_aria: 'לב ים בפייסבוק',

      hero_video_alt: 'לב ים — שקיעה מול הים',
      hero_title_html: 'המקום שבו <span class="hero-accent">הלב</span> פוגש את <span class="hero-accent-blue">הים</span>',
      hero_lead: 'מרחב פתוח על קו המים - לעבודה, מפגש, יצירה ומנוחה.',
      hero_cta_wa: 'דברו איתנו בוואטסאפ',
      hero_cta_services: 'מה קורה בלב ים',

      intro_p_html: 'על קו המים של כפר הדייגים הקסום, האחרון מסוגו בישראל, הקמנו את <strong class="intro-brand">לב ים</strong> - מרחב ליזמות עסקית חברתית המבוסס על שותפות, פשטות וקבלה.',

      services_title: 'מה קורה בלב ים',
      services_intro: 'אל מול נוף עוצר נשימה, ליד הדייגים - בתוך הכפר, קורים הדברים הכי טובים',

      service_corp_title: 'אירועים עסקיים',
      service_corp_desc: 'ימי גיבוש, אסטרטגיה ויציאה מהשגרה.',
      service_corp_cta: 'השאירו פרטים',
      service_corp_alt: 'אירוע עסקי קבוצתי תחת הפרגולה של לב ים',

      service_priv_title: 'אירועים פרטיים',
      service_priv_desc: 'חגיגות אינטימיות עם אוכל מקומי טרי.',
      service_priv_cta: 'תכננו אירוע פרטי',
      service_priv_alt: 'שולחן ערוך לארוחה מול סירות הדייגים בלב ים',

      service_rent_title: 'השכרת המתחם',
      service_rent_desc: 'המקום כולו לרשותכם - לאירוע, סדנה או רטריט.',
      service_rent_cta: 'דברו איתנו על השכרה',
      service_rent_alt: 'שקיעה כתומה מהפרגולה עם ספסל מול הים בלב ים',

      service_comm_title: 'יום ראשון לקהילה',
      service_comm_desc: 'מדי יום ראשון - יזמים ויוצרים מתכנסים לפתוח יחד את השבוע - לעבוד, לשוחח ולהתחבר.',
      service_comm_cta: 'הצטרפו ליום הקהילה',
      service_comm_alt: 'קהילת לב ים — אנשים מתכנסים תחת הפרגולה מול הים',

      service_week_title: 'סופי שבוע בלב ים',
      service_week_desc: 'כל שישי ושבת - בית פתוח, אוכל מקומי ואירועי תוכן מתחלפים.',
      service_week_cta: 'לפרטים על סופי שבוע',
      service_week_alt: 'ארוחה משפחתית עם נוף הים בלב ים',

      why_title: 'למה לב ים',
      why_p1: 'מעטים המקומות שמעניקים את התחושה שהם כמו נבראו מסיבה מסוימת.',
      why_p2_html: 'רצועת חוף בתולית, מבנה דייגים עתיק, שקט, שלווה, אנשים לבביים — זה רק חלק מהקסם של <strong>לב ים</strong> בכפר הדייגים ג׳יסר א-זרקא.',
      why_p3_html: '<strong>לב ים</strong> לא ״ממוקם״ בג׳יסר, אלא פועל מתוכה ובשבילה. לא כרקע — אלא כשותפה. הרגע הזה של שקט עבורכם, לטובת התארגנות מחדש — מקדם חזון של חיבור אנושי חיובי ושגשוג משותף, ומבטיח שהלב ימשיך לפעום ולהדהד גם הרחק מעבר לקו המים.',
      village_title: 'על ג׳יסר א-זרקא וכפר הדייגים',
      village_p1: 'ג׳יסר א-זרקא הוא הכפר הערבי-מוסלמי היחיד שנותר על קו החוף הישראלי, בלב רצועת חוף הכרמל. הפארק הלאומי, כפר הדייגים, בו ממוקם לב ים שומר על אופי ייחודי - סירות עץ, רשתות, ריח של ים והיסטוריה משפחתית.',
      village_p2: 'כל ביקור כאן הוא גם מפגש עם מקום, עם אנשים, ועם סיפור.',

      gallery_title: 'גלריה',
      gallery_sub: 'רגעים מלב ים',
      gallery_open_prefix: 'פתח תמונה',
      gallery_descs: [
        'שקיעה עם סירת דייגים בלב ים',
        'שקיעה כתומה עם סירה וגומא מול הים',
        'חלון ישן עם נוף שקיעה מבפנים בלב ים',
        'אנשים עובדים יחד בחוץ מול הים בלב ים',
        'שיחה בין אנשים בכפר הדייגים',
        'אדם עובד לבד מול הים בלב ים',
        'קהילה מגוונת של ילדים ומבוגרים בחצר לב ים',
        'כורסאות ישנות מול חלונות עם נוף הים בלב ים',
        'מבט מלמעלה על חלל העבודה המשותף בלב ים',
        'קנים ירוקים עם סירה וחוף הים בלב ים',
        'מבט אווירי על כפר הדייגים בלב ים',
        'מחשב נייד ושולחן עבודה מול חלונות הים בלב ים',
        'ארוחה מקומית עם נוף הים בלב ים',
        'רגע משפחתי על כריות כתומות מול הים בלב ים',
        'חברים נהנים יחד מול הים בלב ים',
        'אנשים ליד הים בשקיעה בכפר הדייגים בלב ים',
        'שיחה ועבודה מול חלונות הים בלב ים',
        'שקיעה כתומה עם סירת דייגים מתחת לפרגולה בלב ים'
      ],

      lightbox_aria: 'תמונה מוגדלת',
      lightbox_close: 'סגור תמונה',
      lightbox_prev: 'תמונה הקודמת',
      lightbox_next: 'תמונה הבאה',

      faq_title: 'שאלות ותשובות',
      faq_q_arrive: 'איך מגיעים ללב ים?',
      faq_a_arrive_html: 'ג׳יסר א-זרקא נגישה ברכב מכביש <bdi>4</bdi>, כשעה מתל אביב וכ-<bdi>25</bdi> דקות מחיפה. בירידה בכפר לכיוון הים מגיעים לכפר הדייגים. יש חניה מסודרת בכניסה. הכי פשוט, שימו בוויז לב ים ותמצאו אותנו.',
      faq_q_capacity: 'כמה אנשים יכולים להגיע?',
      faq_a_capacity_html: 'המתחם מתאים לקבוצות של עד כ-<bdi>50</bdi> איש לאירועי ישיבה, ואף יכול להתאים לקבוצות גדולות יותר בהתאם לאופי האירוע שלכם.',
      faq_q_amenities: 'מה כלול במתחם ומה לגבי אוכל?',
      faq_a_amenities: 'פינות ישיבה מגוונות, מטבח מאובזר, כלי מטבח והגשה, אינטרנט מהיר, טלוויזיה גדולה להקרנה, מדשאה מפנקת, מקלחות, שירותים וכלי עבודה. אפשר גם להזמין ארוחה מלאה, פינוקים בין הישיבות, או ארוחת ערב חגיגית — נשמח להתאים לכם את החוויה המושלמת.',
      faq_q_safety: 'האם המקום מתאים למשפחות ובטוח להגיע?',
      faq_a_safety: 'בהחלט. ג׳יסר א-זרקא היא כפר ערבי-מוסלמי שקט ומסביר פנים, שביל ישראל עובר לאורכו וכפר הדייגים הוא פארק לאומי רשמי. החוף נגיש ובטוח, יש מרחב פתוח לילדים לרוץ בו, ובאירועים פרטיים אפשר לתאם פעילות מותאמת.',
      faq_q_rental: 'האם אפשר לשכור את המתחם לכל היום?',
      faq_a_rental: 'בהחלט. אפשר לשכור את המתחם כולו ליום, לסוף שבוע, או לתקופה ארוכה יותר — לסדנה, לריטריט או לאירוע פרטי. לא קיימת אפשרות לינה.',
      faq_q_community: 'מה לוח הזמנים של ימי הקהילה?',
      faq_a_community: 'ימי הקהילה מתקיימים בימי ראשון. כל הפרטים עוברים בקבוצת הוואטסאפ של חבורת לב ים. במידה ואתם מעוניינים לקחת חלק תפנו אלינו.',
      faq_q_book: 'איך אני מזמין?',
      faq_a_book: 'הדרך הכי פשוטה — שלחו לנו הודעת וואטסאפ עם כמה פרטים על מה שאתם מחפשים, ונחזור אליכם בהקדם.',

      contact_title: 'דברו איתנו',
      contact_sub: 'יש דברים שצריך לחוות כדי להבין - בואו לבקר בלב ים.',
      map_aria: 'המיקום של לב ים — כפר הדייגים, ג׳יסר א-זרקא',
      map_fallback: 'לב ים · ג׳יסר א-זרקא',
      map_cta: 'נווטו ב-Google Maps',
      map_marker_alt: 'לב ים — פתחו ב-Google Maps',
      map_marker_title: 'פתחו את לב ים ב-Google Maps',

      contact_intro: 'מה תרצו לעשות?',
      contact_btn_team_title: 'אנחנו צוות',
      contact_btn_team_sub: 'חוויה צוותית ויום גיבוש',
      contact_btn_join_title: 'אני רוצה להצטרף',
      contact_btn_join_sub: 'קהילה ויזמות חברתית',
      contact_btn_priv_title: 'אירוע פרטי',
      contact_btn_priv_sub: 'חגיגה משפחתית או אישית',
      contact_btn_dream_title: 'יש לי חלום',
      contact_btn_dream_sub: 'השכרת המרחב לפרוייקט שלי',

      footer_tagline: 'מרחב יזמות עסקית חברתית על קו המים',
      footer_phone_aria: 'התקשרו ללב ים',
      footer_email_aria: 'שלחו מייל ללב ים',
      footer_wa_aria: 'וואטסאפ לב ים',
      footer_ig_aria: 'אינסטגרם לב ים',
      footer_fb_aria: 'פייסבוק לב ים',
      footer_map_aria: 'מיקום לב ים',
      footer_credit_html: '© לב ים <bdi>2026</bdi>',

      wa_float_aria: 'צור קשר בוואטסאפ',

      wa_msg_general: 'שלום, אשמח לפרטים על לב ים',
      wa_msg_corp: 'שלום, אנחנו מחפשים חוויה צוותית בלב ים',
      wa_msg_priv: 'שלום, אשמח להגיע עם המשפחה לחגיגה',
      wa_msg_rent: 'שלום, אשמח למצוא בית לחלום שלי',
      wa_msg_comm: 'שלום, אשמח להצטרף ליום הקהילה',
      wa_msg_week: 'שלום, אשמח לפרטים על סופי שבוע בלב ים',
      wa_msg_team: 'שלום, אנחנו צוות שמחפשים חוויה',
      wa_msg_join: 'שלום, אשמח להצטרף לקהילה',
      wa_msg_family: 'שלום, אנחנו משפחה שמתכננת אירוע',
      wa_msg_dream: 'שלום, יש לי חלום שמחפש בית'
    },

    ar: {
      meta_title: 'ليف يام | فضاء لريادة الأعمال الاجتماعية على خط الماء',
      meta_desc: 'فضاء لريادة الأعمال الاجتماعية، قائم على الشراكة والبساطة والقبول.',
      og_locale: 'ar_IL',

      brand: 'ليف يام',
      skip_link: 'تخطّى إلى المحتوى الأساسي',

      logo_aria: 'ليف يام — الصفحة الرئيسية',
      nav_main_aria: 'القائمة الرئيسية',
      nav_services: 'ماذا يجري في ليف يام',
      nav_why: 'لماذا ليف يام',
      nav_gallery: 'معرض الصور',
      nav_faq: 'أسئلة وأجوبة',
      nav_contact: 'تواصلوا معنا',

      nav_open: 'فتح القائمة',
      nav_close: 'إغلاق القائمة',
      mobile_nav_aria: 'قائمة الهاتف',
      mobile_nav_close: 'إغلاق القائمة',

      lang_toggle_aria: 'اللغة / שפה',

      social_wa_aria: 'ليف يام على واتساب',
      social_email_aria: 'أرسلوا إيميل إلى ليف يام',
      social_map_aria: 'تنقّلوا إلى ليف يام على الخرائط',
      social_ig_aria: 'ليف يام على إنستغرام',
      social_fb_aria: 'ليف يام على فيسبوك',

      hero_video_alt: 'ليف يام — غروب الشمس على البحر',
      hero_title_html: 'حيث يلتقي <span class="hero-accent">القلب</span> بـ<span class="hero-accent-blue">البحر</span>',
      hero_lead: 'فضاء مفتوح على خط الماء — للعمل واللقاء والإبداع والراحة.',
      hero_cta_wa: 'تحدّثوا معنا على واتساب',
      hero_cta_services: 'ماذا يجري في ليف يام',

      intro_p_html: 'على خط الماء في قرية الصيادين الساحرة، الأخيرة من نوعها في البلاد، أقمنا <strong class="intro-brand">ليف يام</strong> — فضاءً لريادة الأعمال الاجتماعية، قائمًا على الشراكة والبساطة والقبول.',

      services_title: 'ماذا يجري في ليف يام',
      services_intro: 'أمام منظر يخطف الأنفاس، إلى جانب الصيادين — في قلب القرية، تحدث أجمل الأشياء',

      service_corp_title: 'فعاليات الأعمال',
      service_corp_desc: 'أيام تماسك للفريق، استراتيجية، وخروج من الروتين.',
      service_corp_cta: 'اتركوا تفاصيلكم',
      service_corp_alt: 'فعالية أعمال جماعية تحت العريشة في ليف يام',

      service_priv_title: 'فعاليات خاصة',
      service_priv_desc: 'احتفالات حميمة مع طعام محلي طازج.',
      service_priv_cta: 'خطّطوا فعالية خاصة',
      service_priv_alt: 'طاولة معدّة لوجبة أمام قوارب الصيادين في ليف يام',

      service_rent_title: 'استئجار المكان',
      service_rent_desc: 'المكان كلّه تحت تصرّفكم — لفعالية أو ورشة أو خلوة.',
      service_rent_cta: 'تحدّثوا معنا حول الاستئجار',
      service_rent_alt: 'غروب برتقالي من العريشة مع مقعد مقابل البحر في ليف يام',

      service_comm_title: 'يوم الأحد للمجتمع',
      service_comm_desc: 'كل يوم أحد — روّاد أعمال ومبدعون يجتمعون لافتتاح الأسبوع معًا — للعمل والحديث والتواصل.',
      service_comm_cta: 'انضمّوا إلى يوم المجتمع',
      service_comm_alt: 'مجتمع ليف يام — ناس يجتمعون تحت العريشة أمام البحر',

      service_week_title: 'عطلات نهاية الأسبوع في ليف يام',
      service_week_desc: 'كل جمعة وسبت — بيت مفتوح، طعام محلي، وفعاليات متجدّدة.',
      service_week_cta: 'تفاصيل عن عطلات نهاية الأسبوع',
      service_week_alt: 'وجبة عائلية بإطلالة على البحر في ليف يام',

      why_title: 'لماذا ليف يام',
      why_p1: 'قليلة هي الأماكن التي تمنحك إحساسًا بأنها خُلقت لسببٍ ما.',
      why_p2_html: 'شريط شاطئ بِكر، مبنى صيادين عتيق، هدوء، سكينة، وناس بقلوب دافئة — هذا جزء فقط من سحر <strong>ليف يام</strong> في قرية الصيادين بجسر الزرقاء.',
      why_p3_html: '<strong>ليف يام</strong> ليس "موجودًا" في جسر الزرقاء فحسب، بل يعمل من داخلها ولأجلها. ليس كخلفية — بل كشريكة. هذه اللحظة من السكون لكم، لإعادة ترتيب الأمور — تدفع رؤيةً للتواصل الإنساني الإيجابي والازدهار المشترك، وتضمن أن يبقى القلب خافقًا ومتردّدًا حتى بعيدًا عن خط الماء.',
      village_title: 'عن جسر الزرقاء وقرية الصيادين',
      village_p1: 'جسر الزرقاء هي القرية العربية المسلمة الوحيدة المتبقية على خط الساحل، في قلب شريط شاطئ الكرمل. الحديقة الوطنية، قرية الصيادين، التي يقع فيها ليف يام تحافظ على طابع فريد — قوارب خشبية، شِباك، رائحة البحر، وتاريخ عائلي.',
      village_p2: 'كل زيارة هنا هي لقاء مع المكان، مع الناس، ومع حكاية.',

      gallery_title: 'معرض الصور',
      gallery_sub: 'لحظات من ليف يام',
      gallery_open_prefix: 'افتح الصورة',
      gallery_descs: [
        'غروب الشمس مع قارب صياد في ليف يام',
        'غروب برتقالي مع قارب وقصب على البحر',
        'نافذة قديمة بإطلالة على الغروب من داخل ليف يام',
        'أناس يعملون معًا في الخارج أمام البحر في ليف يام',
        'حديث بين الناس في قرية الصيادين',
        'شخص يعمل وحده أمام البحر في ليف يام',
        'مجتمع متنوّع من الأطفال والكبار في باحة ليف يام',
        'كراسي قديمة أمام نوافذ بإطلالة على البحر في ليف يام',
        'إطلالة من الأعلى على فضاء العمل المشترك في ليف يام',
        'قصب أخضر مع قارب وشاطئ البحر في ليف يام',
        'إطلالة جوية على قرية الصيادين في ليف يام',
        'حاسوب محمول وطاولة عمل أمام نوافذ البحر في ليف يام',
        'وجبة محلية بإطلالة على البحر في ليف يام',
        'لحظة عائلية على وسائد برتقالية أمام البحر في ليف يام',
        'أصدقاء يستمتعون معًا أمام البحر في ليف يام',
        'أناس قرب البحر عند الغروب في قرية الصيادين في ليف يام',
        'حديث وعمل أمام نوافذ البحر في ليف يام',
        'غروب برتقالي مع قارب صياد تحت العريشة في ليف يام'
      ],

      lightbox_aria: 'صورة مكبّرة',
      lightbox_close: 'إغلاق الصورة',
      lightbox_prev: 'الصورة السابقة',
      lightbox_next: 'الصورة التالية',

      faq_title: 'أسئلة وأجوبة',
      faq_q_arrive: 'كيف نصل إلى ليف يام؟',
      faq_a_arrive_html: 'جسر الزرقاء يمكن الوصول إليها بالسيارة من شارع <bdi>4</bdi>، نحو ساعة من تل أبيب وحوالي <bdi>25</bdi> دقيقة من حيفا. عند النزول في القرية باتجاه البحر تصلون إلى قرية الصيادين. هناك موقف منظّم عند المدخل. الأبسط، اكتبوا في ويز "ليف يام" وستجدوننا.',
      faq_q_capacity: 'كم شخصًا يمكنه أن يأتي؟',
      faq_a_capacity_html: 'المكان مناسب لمجموعات حتى نحو <bdi>50</bdi> شخصًا لفعاليات بالجلوس، ويمكن أن يستوعب مجموعات أكبر بحسب طبيعة الفعالية.',
      faq_q_amenities: 'ماذا يشمل المكان وماذا عن الطعام؟',
      faq_a_amenities: 'زوايا جلوس متنوّعة، مطبخ مجهّز، أدوات مطبخ وتقديم، إنترنت سريع، تلفاز كبير للعرض، حديقة جميلة، حمّامات استحمام، خدمات، وأدوات عمل. يمكنكم أيضًا طلب وجبة كاملة، أو ضيافات بين الجلسات، أو عشاء احتفالي — يسعدنا أن نُلائم لكم التجربة المثالية.',
      faq_q_safety: 'هل المكان مناسب للعائلات وآمن للوصول؟',
      faq_a_safety: 'تمامًا. جسر الزرقاء قرية عربية مسلمة هادئة ومرحّبة، ودرب إسرائيل يمرّ بمحاذاتها وقرية الصيادين هي حديقة وطنية رسمية. الشاطئ آمن وسهل الوصول، هناك فضاء مفتوح للأطفال للجري، وفي الفعاليات الخاصة يمكن تنسيق نشاطات ملائمة.',
      faq_q_rental: 'هل يمكن استئجار المكان طوال اليوم؟',
      faq_a_rental: 'بالتأكيد. يمكن استئجار المكان كاملًا ليوم، أو لعطلة نهاية الأسبوع، أو لفترة أطول — لورشة، خلوة، أو فعالية خاصة. لا تتوفّر إمكانية المبيت.',
      faq_q_community: 'ما هو جدول أيام المجتمع؟',
      faq_a_community: 'أيام المجتمع تُقام أيام الأحد. كل التفاصيل تُنشر في مجموعة الواتساب الخاصة بأهل ليف يام. إن أردتم المشاركة، تواصلوا معنا.',
      faq_q_book: 'كيف أحجز؟',
      faq_a_book: 'الطريقة الأبسط — أرسلوا لنا رسالة واتساب مع بعض التفاصيل عمّا تبحثون عنه، وسنعود إليكم في أقرب وقت.',

      contact_title: 'تحدّثوا معنا',
      contact_sub: 'هناك أمور لا تُفهم إلا بتجربتها — تعالوا لزيارة ليف يام.',
      map_aria: 'موقع ليف يام — قرية الصيادين، جسر الزرقاء',
      map_fallback: 'ليف يام · جسر الزرقاء',
      map_cta: 'تنقّلوا عبر Google Maps',
      map_marker_alt: 'ليف يام — افتحوا في Google Maps',
      map_marker_title: 'افتحوا ليف يام في Google Maps',

      contact_intro: 'ماذا تريدون أن تفعلوا؟',
      contact_btn_team_title: 'نحن فريق',
      contact_btn_team_sub: 'تجربة جماعية ويوم تماسك',
      contact_btn_join_title: 'أريد أن أنضمّ',
      contact_btn_join_sub: 'مجتمع وريادة أعمال اجتماعية',
      contact_btn_priv_title: 'فعالية خاصة',
      contact_btn_priv_sub: 'احتفال عائلي أو شخصي',
      contact_btn_dream_title: 'عندي حلم',
      contact_btn_dream_sub: 'استئجار الفضاء لمشروعي',

      footer_tagline: 'فضاء لريادة الأعمال الاجتماعية على خط الماء',
      footer_phone_aria: 'اتّصلوا بليف يام',
      footer_email_aria: 'أرسلوا بريدًا إلى ليف يام',
      footer_wa_aria: 'واتساب ليف يام',
      footer_ig_aria: 'إنستغرام ليف يام',
      footer_fb_aria: 'فيسبوك ليف يام',
      footer_map_aria: 'موقع ليف يام',
      footer_credit_html: '© ليف يام <bdi>2026</bdi>',

      wa_float_aria: 'تواصلوا عبر واتساب',

      wa_msg_general: 'أهلًا، بحب آخذ تفاصيل عن ليف يام',
      wa_msg_corp: 'أهلًا، نحن ندوّر على تجربة جماعية في ليف يام',
      wa_msg_priv: 'أهلًا، بحب آجي مع العيلة لاحتفال',
      wa_msg_rent: 'أهلًا، بحب ألاقي بيت لحلمي',
      wa_msg_comm: 'أهلًا، بحب أنضمّ ليوم المجتمع',
      wa_msg_week: 'أهلًا، بحب آخذ تفاصيل عن عطلات نهاية الأسبوع في ليف يام',
      wa_msg_team: 'أهلًا، نحن فريق وعم ندوّر على تجربة',
      wa_msg_join: 'أهلًا، بحب أنضمّ للمجتمع',
      wa_msg_family: 'أهلًا، نحن عيلة وعم نخطّط لفعالية',
      wa_msg_dream: 'أهلًا، عندي حلم بدور على بيت'
    }
  };

  let currentLang = 'he';
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'ar') currentLang = 'ar';
  } catch (e) { /* localStorage blocked */ }

  function t(key) {
    const dict = translations[currentLang] || translations.he;
    if (dict[key] != null) return dict[key];
    return translations.he[key] != null ? translations.he[key] : '';
  }

  const ATTR_LIST = ['aria-label', 'alt', 'title', 'placeholder'];

  function applyTranslations() {
    const dict = translations[currentLang] || translations.he;

    document.documentElement.lang = currentLang;
    // Both Hebrew and Arabic are RTL; keep dir as-is.

    if (dict.meta_title) document.title = dict.meta_title;
    setMeta('meta[name="description"]', 'content', dict.meta_desc);
    setMeta('meta[property="og:title"]', 'content', dict.meta_title);
    setMeta('meta[property="og:description"]', 'content', dict.meta_desc);
    setMeta('meta[property="og:locale"]', 'content', dict.og_locale);

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      if (dict[key] != null) el.textContent = dict[key];
    });

    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-html');
      if (dict[key] != null) el.innerHTML = dict[key];
    });

    ATTR_LIST.forEach(function (attr) {
      document.querySelectorAll('[data-i18n-' + attr + ']').forEach(function (el) {
        const key = el.getAttribute('data-i18n-' + attr);
        if (dict[key] != null) el.setAttribute(attr, dict[key]);
      });
    });

    document.querySelectorAll('[data-i18n-wa]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-wa');
      const txt = dict[key];
      if (txt != null) {
        el.href = 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(txt);
      }
    });

    const descs = dict.gallery_descs || [];
    const prefix = dict.gallery_open_prefix || '';
    document.querySelectorAll('[data-i18n-gallery]').forEach(function (el) {
      const idx = parseInt(el.getAttribute('data-i18n-gallery'), 10);
      const desc = descs[idx];
      if (desc == null) return;
      const num = idx + 1;
      const img = el.querySelector('img');
      if (img) img.alt = desc;
      el.setAttribute('aria-label', prefix + ' ' + num + ' — ' + desc);
    });

    document.querySelectorAll('.lang-toggle [data-lang-set]').forEach(function (opt) {
      const isActive = opt.getAttribute('data-lang-set') === currentLang;
      opt.classList.toggle('is-active', isActive);
      opt.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: currentLang } }));
  }

  function setMeta(selector, attr, value) {
    if (value == null) return;
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  }

  function setLang(lang) {
    if (lang !== 'he' && lang !== 'ar') return;
    if (lang === currentLang) return;
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    applyTranslations();
  }

  document.addEventListener('click', function (e) {
    const opt = e.target.closest && e.target.closest('[data-lang-set]');
    if (!opt) return;
    e.preventDefault();
    setLang(opt.getAttribute('data-lang-set'));
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTranslations);
  } else {
    applyTranslations();
  }

  return {
    get lang() { return currentLang; },
    t: t,
    setLang: setLang
  };
})();


/* ── Mobile menu toggle ───────────────────────────────────────────────── */
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  if (!toggle || !mobileNav) return;

  function refreshLabel() {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-label', LevYamI18n.t(isOpen ? 'nav_close' : 'nav_open'));
  }

  function closeMenu() {
    toggle.setAttribute('aria-expanded', 'false');
    mobileNav.hidden = true;
    refreshLabel();
  }

  toggle.addEventListener('click', function () {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      closeMenu();
    } else {
      toggle.setAttribute('aria-expanded', 'true');
      mobileNav.hidden = false;
      refreshLabel();
    }
  });

  // Close button inside the nav
  var btnClose = mobileNav.querySelector('.mobile-nav-close');
  if (btnClose) {
    btnClose.addEventListener('click', function () { closeMenu(); toggle.focus(); });
  }

  // Close when a nav link is clicked
  mobileNav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      toggle.focus();
    }
  });

  // Keep label in sync when language changes
  document.addEventListener('langchange', refreshLabel);
})();

/* ── Section reveals (IntersectionObserver, fires once) ──────────────── */
(function () {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const revealEls = document.querySelectorAll('.reveal');
  if (!revealEls.length) return;

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  revealEls.forEach(function (el) {
    observer.observe(el);
  });
})();

/* ── Gallery lightbox ─────────────────────────────────────────────────── */
(function () {
  const lightbox  = document.getElementById('lightbox');
  const lightImg  = lightbox && lightbox.querySelector('.lightbox-img');
  const btnClose  = lightbox && lightbox.querySelector('.lightbox-close');
  const btnPrev   = lightbox && lightbox.querySelector('.lightbox-prev');
  const btnNext   = lightbox && lightbox.querySelector('.lightbox-next');
  const items     = Array.from(document.querySelectorAll('.gallery-item'));

  if (!lightbox || !items.length) return;

  let currentIndex = 0;
  let lastTrigger  = null;

  function altFor(item) {
    const img = item.querySelector('img');
    return (img && img.alt) || '';
  }

  function open(index) {
    currentIndex = index;
    const item   = items[index];
    const src    = item.dataset.full || '';

    lightImg.src = src;
    lightImg.alt = altFor(item);

    lightbox.showModal();
    btnClose.focus();
  }

  function close() {
    lightbox.close();
    lightImg.src = '';
    if (lastTrigger) lastTrigger.focus();
  }

  function navigate(direction) {
    currentIndex = (currentIndex + direction + items.length) % items.length;
    const item   = items[currentIndex];
    lightImg.src = item.dataset.full || '';
    lightImg.alt = altFor(item);
  }

  items.forEach(function (item, i) {
    item.addEventListener('click', function () {
      lastTrigger = item;
      open(i);
    });
  });

  btnClose.addEventListener('click', close);
  btnPrev.addEventListener('click', function () { navigate(-1); });
  btnNext.addEventListener('click', function () { navigate(1); });

  // Close on backdrop click
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) close();
  });

  // Keyboard navigation
  lightbox.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp')   navigate(-1);
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown')  navigate(1);
  });

  // Touch swipe
  let touchStartX = 0;
  lightbox.addEventListener('touchstart', function (e) {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  lightbox.addEventListener('touchend', function (e) {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) navigate(diff > 0 ? 1 : -1);
  }, { passive: true });
})();

/* ── Lev Yam map (Leaflet + CARTO tiles, lazy-loaded) ─────────────────── */
(function () {
  const frame = document.querySelector('.map-frame');
  const canvas = document.getElementById('lev-yam-map');
  if (!frame || !canvas) return;

  const lat = parseFloat(frame.dataset.lat);
  const lng = parseFloat(frame.dataset.lng);
  const ctaLink = frame.querySelector('.map-cta');
  const mapUrl = ctaLink ? ctaLink.href : '';
  if (Number.isNaN(lat) || Number.isNaN(lng)) return;

  const PIN_SVG =
    '<svg viewBox="0 0 24 32" class="lym-pin" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="lymPinGrad" x1="0.5" y1="0" x2="0.5" y2="1">' +
          '<stop offset="0%" stop-color="#f8a94f"/>' +
          '<stop offset="100%" stop-color="#d97f1f"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<path d="M12 0 C5.4 0 0 5.4 0 12 c0 9 12 20 12 20 s12-11 12-20 C24 5.4 18.6 0 12 0z" ' +
            'fill="url(#lymPinGrad)" stroke="#a86214" stroke-width="0.7"/>' +
      '<circle cx="12" cy="12" r="4.2" fill="#fff7ea" stroke="#d97f1f" stroke-width="0.6"/>' +
    '</svg>';

  const LEAFLET_VERSION = '1.9.4';
  const LEAFLET_CSS = 'https://unpkg.com/leaflet@' + LEAFLET_VERSION + '/dist/leaflet.css';
  const LEAFLET_JS  = 'https://unpkg.com/leaflet@' + LEAFLET_VERSION + '/dist/leaflet.js';

  let loadingPromise = null;
  let mapMarker = null;

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (loadingPromise) return loadingPromise;

    loadingPromise = new Promise(function (resolve, reject) {
      // Inject CSS
      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = LEAFLET_CSS;
        link.dataset.leaflet = '1';
        document.head.appendChild(link);
      }
      // Inject JS
      const script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.async = true;
      script.onload = function () { resolve(window.L); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return loadingPromise;
  }

  function buildMap(L) {
    if (canvas.dataset.mapInit === '1') return;
    canvas.dataset.mapInit = '1';

    const map = L.map(canvas, {
      center: [lat, lng],
      zoom: 15,
      minZoom: 8,
      maxZoom: 16,
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    });

    // Israel Hiking Map (Hebrew) — free, no API key, Hebrew labels (attribution required)
    L.tileLayer('https://israelhiking.osm.org.il/Hebrew/Tiles/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://israelhiking.osm.org.il" target="_blank" rel="noopener">Israel Hiking Map</a> · &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 16,
    }).addTo(map);

    const icon = L.divIcon({
      className: 'lev-yam-marker',
      html:
        '<span class="lym-pulse" aria-hidden="true"></span>' +
        PIN_SVG,
      iconSize:   [40, 52],
      iconAnchor: [20, 50],
    });

    mapMarker = L.marker([lat, lng], {
      icon: icon,
      alt: LevYamI18n.t('map_marker_alt'),
      title: LevYamI18n.t('map_marker_title'),
      riseOnHover: true,
      keyboard: true,
    }).addTo(map);

    if (mapUrl) {
      mapMarker.on('click', function () {
        window.open(mapUrl, '_blank', 'noopener');
      });
      // Keyboard activation (Enter / Space) on the marker element
      const el = mapMarker.getElement();
      if (el) {
        el.setAttribute('role', 'link');
        el.setAttribute('tabindex', '0');
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.open(mapUrl, '_blank', 'noopener');
          }
        });
      }
    }

    // Reveal fade — hide the fallback once tiles arrive
    map.whenReady(function () {
      requestAnimationFrame(function () { frame.classList.add('is-ready'); });
    });
  }

  function refreshMarkerLabels() {
    if (!mapMarker) return;
    const el = mapMarker.getElement();
    const altTxt = LevYamI18n.t('map_marker_alt');
    const titleTxt = LevYamI18n.t('map_marker_title');
    if (el) {
      el.setAttribute('alt', altTxt);
      el.setAttribute('title', titleTxt);
    }
  }
  document.addEventListener('langchange', refreshMarkerLabels);

  function init() {
    loadLeaflet().then(buildMap).catch(function () {
      // On load failure leave the fallback visible — graceful degradation
    });
  }

  // Lazy-load: only fetch Leaflet when the map nears the viewport
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          io.disconnect();
          init();
        }
      });
    }, { rootMargin: '300px 0px' });
    io.observe(frame);
  } else {
    init();
  }
})();

/* ── WhatsApp pulse — stop after first page interaction ──────────────── */
(function () {
  const btn = document.querySelector('.wa-float');
  if (!btn) return;

  const STORAGE_KEY = 'lev-yam-wa-interacted';

  if (localStorage.getItem(STORAGE_KEY)) {
    btn.classList.add('pulse-stopped');
    return;
  }

  function stopPulse() {
    btn.classList.add('pulse-stopped');
    localStorage.setItem(STORAGE_KEY, '1');
    document.removeEventListener('click', stopPulse);
    document.removeEventListener('scroll', stopPulse, { passive: true });
  }

  document.addEventListener('click', stopPulse);
  document.addEventListener('scroll', stopPulse, { passive: true });
})();
