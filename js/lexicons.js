// Word lists used by the analyzer. English, Persian and Finglish (Persian in Latin letters).
// All entries are lowercase and Persian entries use normalized letters (ی / ک).

const words = (s) => s.trim().split(/\s+/);

export const STOPWORDS = new Set([
  // English
  ...words(`a about above after again against all am an and any are aren't as at be because been before being
  below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each
  few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him
  himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself
  no nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's
  should shouldn't so some such than that that's the their theirs them themselves then there there's these they
  they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've
  were weren't what what's when when's where where's which while who who's whom why why's with won't would wouldn't
  you you'd you'll you're you've your yours yourself yourselves im ive id ill dont doesnt didnt cant wont isnt arent
  wasnt thats whats u ur r ya yeah yes yep no nope ok okay oh ah like just get got also really will one go going
  know think well now even still much would could should gonna wanna gotta lol haha hahaha hah xd its tho though
  thing things something anything there's let make made way want need see say said time back yea yh k kk hmm mm
  hm umm uh im it’s i’m don’t that’s can’t didn’t`),
  // Persian
  ...words(`و در به از که این را با است آن برای تا یا هم من تو او ما شما آنها ایشان رو ها های می نمی هست نیست بود
  بودم بودی باشه باشد شد شده شود میشه نمیشه کرد کردم کردی کنم کنی کنه کن کنید داره دارم داری دارید داشت ندارم نداره
  یه یک دو اون اینو اونو اینا اونا ولی اما اگر اگه چون چه چی چیه چرا کی کجا چطور چطوری کو هر همه همین همون خیلی
  خب خوب دیگه دیگر الان حالا بعد قبل باید نباید شاید فقط هنوز بازم باز هی ها آره اره نه نع آها اوه اوکی باشه منم
  توام توهم اونم مثل مثلا یعنی پس رو روی زیر بین سر توی تو تا تی دی ام ای اینجا اونجا اینم اونم دیگه بهت بهم بهش
  ازت ازم ازش برات برام براش باهات باهام باهاش خودم خودت خودش ما هامون مون تون شون م ت ش هستم هستی هستیم بودیم
  میخوام میخوای میخواد میگم میگی میگه گفتم گفتی گفت بگو بگم بگی ببین دیدم دیدی`),
  // Finglish
  ...words(`va dar be az ke in ra ba ast an baraye ta ya ham man to oon un ma shoma ona hast nist bood boodam bashe
  shod shode mishe nemishe kard kardam kardi konam koni kone kon dare daram dari nadaram yeh ye do ino uno ina una
  vali ama age chon che chi chie chera ki koja chetor chetori har hame hamin khayli kheili khili khob dige alan hala
  bad baad bayad shayad faghat hanooz are areh na mm aha ok oke okay bashe manam toam mesle masalan yani pas
  roo ro zire sare tooye too inja oonja behet behem behesh azat azam barat baram barash bahat baham khodam khodet
  khodesh hastam hasti mikham mikhay mige migi migam goftam gofti goft begoo begam bebin didam didi`),
]);

// Laughs: matched against a lowercased message.
export const LAUGH_RE = new RegExp(
  [
    String.raw`\b(?:a?h[ae]){2,}h?\b`, // haha, hehe, ahahah
    String.raw`\bha+h+a+[ha]*\b`,
    String.raw`\ba(?:ha){2,}h?\b`,
    String.raw`\blo+l+\b`,
    String.raw`\blmf?a+o+\b`,
    String.raw`\brofl\b`,
    String.raw`\bx+d+\b`,
    String.raw`\bkhe?(?:kh)+\b`, // khkhkh / kheekh
    String.raw`خ{3,}`,
    String.raw`(?:ه){3,}`,
    String.raw`(?:ها){2,}`,
    String.raw`(?:هه){2,}`,
    String.raw`[😂🤣😆😹😅😄😁]`,
  ].join("|"),
  "gu",
);

// Counters: each has a label, emoji and a list of patterns.
export const COUNTERS = [
  {
    key: "love", label: "I love you", icon: "❤️",
    re: /\bi\s+love\s+(?:you|u|ya)\b|\blove\s+(?:you|u|ya)\b|\bily\b|\bilysm\b|دوستت\s*دارم|دوست\s*دارمت|عاشقتم|عاشقتمم|\bdoo?se?t(?:et)?\s+daram\b|\basheghetam\b/iu,
  },
  {
    key: "miss", label: "Miss you", icon: "🥺",
    re: /\bmiss(?:ed|ing)?\s+(?:you|u|ya)\b|\bmissu\b|دلم\s*(?:برات|براتون|واست)\s*(?:یه\s*ذره|تنگ)|دلتنگتم|دلتنگت|دلم\s*تنگ|\bdelam\s+(?:barat\s+)?tang\b|\bdeltangetam\b/iu,
  },
  {
    key: "sorry", label: "Sorry", icon: "🙏",
    re: /\bsorry\b|\bsry\b|\bsorr+y+\b|\bmy\s+bad\b|\bapologi[sz]e|\bببخشید\b|ببخشید|ببخش|شرمنده|معذرت|\bbebakhs?hid\b|\bbebakhsh\b|\bsharmande[am]?\b/iu,
  },
  {
    key: "thanks", label: "Thank you", icon: "🌷",
    re: /\bthank(?:s|\s+you|\s+u|u)\b|\bthx\b|\bty\b|\btysm\b|مرسی|ممنون|متشکر|مچکر|سپاس|\bmer[cs]i\b|\bmamnoo?n\b|\bmamnun\b/iu,
  },
  {
    key: "night", label: "Good night", icon: "🌙",
    re: /\bgood\s*night\b|\bg\s?n\b|\bnight\s+night\b|\bsweet\s+dreams\b|شب\s*بخیر|شبت\s*بخیر|خوب\s*بخوابی|\bshab\s*bekheir\b|\bshabet\s+bekheir\b/iu,
  },
  {
    key: "morning", label: "Good morning", icon: "☀️",
    re: /\bgood\s*morning\b|\bgm\b|\bmorning\b|صبح\s*بخیر|صبحت\s*بخیر|\bsob+h?\s*bekheir\b/iu,
  },
];

// Sentiment: tiny lexicon, scored -1..1 per word. Rough by design.
const POS = words(`love loved lovely loving like liked good great awesome amazing nice cool happy glad fun funny best
  beautiful cute sweet perfect wonderful excellent fantastic yay yess yes wow congrats congratulations thanks thank
  proud excited exciting enjoy enjoyed fine okay ok lucky win won brilliant adorable kind haha lol gorgeous incredible
  favorite fav fave miss hug hugs kiss kisses smile laugh peace relax relaxed calm safe welcome super delicious yummy
  دوستت عاشقتم عالی خوب خوبه خوبم قشنگ قشنگه زیبا ممنون مرسی خوشحال خوشحالم باحال بامزه عزیزم عزیز جیگر عشقم عشق
  دلم آفرین مبارک هورا خوشگل خوشگله نازی ناز محشر فوقالعاده خفن ایول دمت لذت بغل بوس ماچ آروم موفق خندیدم
  merci mamnoon azizam eshgham eshgh ali khoobe khubam ghashang khoshhal bahal ayval afarin mobarak naz khoshgel`);
const NEG = words(`hate hated bad sad angry mad upset tired sick hurt pain cry crying cried worried worry worse
  worst awful terrible horrible annoying annoyed boring bored stupid ugh fuck shit damn hell lonely alone afraid
  scared fear stress stressed stressful depressed anxious anxiety broke fail failed failure lost lose miserable
  disappointed disgusting gross wrong sucks hard difficult problem problems issue fight unfair jealous kill dead
  ناراحت ناراحتم بد بده غمگین خسته خستم خسته‌ام عصبانی عصبی گریه درد مریض ترسیدم ترس استرس افسرده دلگیر حالم
  بدم متنفر حرصم زشت مزخرف لعنتی گند افتضاح بیچاره تنها تنهام دعوا مشکل نگران سخته غصه دلخور
  narahat narahatam khaste khastam asabi gerye dard mariz stress bad zesht mozakhraf`);
export const SENTIMENT = new Map([...POS.map((w) => [w, 1]), ...NEG.map((w) => [w, -1])]);
export const SENTIMENT_EMOJI = new Map([
  ...[..."😀😃😄😁😆😊🙂😍🥰😘😻💕💖💗💓💞❤🧡💛💚💙💜🤍🥳🎉👍👏🙌✨🌸🌹🌷😎🤗☺😇"].map((e) => [e, 1]),
  ...[..."😢😭😞😔😟😠😡🤬💔😩😫😤😒🙁☹😣😖👎😰😨😱🥺"].map((e) => [e, -1]),
]);
export const NEGATORS = new Set(words(`not no never dont don't didnt didn't isnt isn't wasnt wasn't cant can't nope
  نه نیست نبود نمی`));

// Topics: keyword sets; a message belongs to each topic it mentions.
export const TOPICS = [
  { key: "food", label: "Food & drinks", icon: "🍕", words: words(`food eat eating ate dinner lunch breakfast pizza burger coffee tea cafe restaurant hungry cook cooking cooked snack cake chocolate drink drinks beer wine sushi rice pasta chicken kebab dessert
    غذا شام ناهار نهار صبحانه پیتزا قهوه چای کافه رستوران گرسنه گشنمه گشنه آشپزی کیک شکلات نوشیدنی کباب برنج جوجه بستنی ghaza sham nahar sobhoone pizza ghahve chai kafe gorosne goshname
    🍕🍔🍟☕🍰🍫🍣🍝🍺🍷🍦`) },
  { key: "work", label: "Work & study", icon: "💼", words: words(`work working job office boss meeting meetings project deadline salary client clients interview email exam exams class classes study studying university uni college school homework thesis professor course assignment code coding paper
    کار کارم شرکت جلسه پروژه حقوق مصاحبه امتحان کلاس دانشگاه درس مدرسه استاد تز پایان‌نامه تکلیف ددلاین رئیس karam sherkat jalase porozhe emtehan kelas daneshgah dars ostad`) },
  { key: "plans", label: "Plans & meetups", icon: "📅", words: words(`tomorrow tonight weekend later today plan plans meet meeting see come coming pick free busy when where tmrw tmr
    فردا امشب آخرهفته بعدا امروز برنامه ببینمت بیام بیا بریم میای میام کجایی آزادی farda emshab bad emruz barname biya berim miay miam kojai`) },
  { key: "feelings", label: "Feelings", icon: "💞", words: words(`love miss feel feeling feelings heart sad happy cry hug kiss sorry care trust worried scared lonely
    دوستت عاشقتم دلم دلتنگ احساس قلب ناراحت خوشحال گریه بغل بوس نگران تنها دلگیر delam eshgham
    ❤️💔🥺😭💕💖`) },
  { key: "fun", label: "Fun & memes", icon: "🎮", words: words(`meme memes game games play playing party movie movies film series netflix show episode music song songs concert video youtube tiktok instagram reel
    بازی فیلم سریال آهنگ موزیک کنسرت ویدیو یوتیوب اینستا مهمونی پارتی ریلز bazi film serial ahang music
    🎮🎬🎵🎶🎉`) },
  { key: "travel", label: "Travel & places", icon: "✈️", words: words(`trip travel travelling traveling flight airport hotel vacation holiday beach city country visa passport train ticket tickets road drive
    سفر پرواز فرودگاه هتل تعطیلات دریا شهر کشور ویزا پاسپورت قطار بلیط جاده شمال safar parvaz hotel visa
    ✈️🏖️🚗🚆`) },
  { key: "money", label: "Money & shopping", icon: "💸", words: words(`money pay paid buy bought price cost expensive cheap shop shopping order amazon rent bill bills bank card dollar dollars euro
    پول خرید خریدم قیمت گرون ارزون فروشگاه سفارش اجاره قبض بانک کارت دلار تومن تومان ریال pool kharid gheymat geroon
    💸💰💳`) },
  { key: "health", label: "Health & sleep", icon: "😴", words: words(`sleep sleeping slept tired sick doctor hospital medicine gym workout run running headache pain covid fever bed nap
    خواب خوابم خوابیدم خسته مریض دکتر بیمارستان دارو باشگاه ورزش سردرد درد تب khab khabam khaste mariz doctor
    😴🤒💊🏋️`) },
  { key: "family", label: "Family & friends", icon: "👨‍👩‍👧", words: words(`mom mum mother dad father sister brother family parents grandma grandpa cousin friend friends wedding birthday
    مامان بابا مادر پدر خواهر برادر داداش آبجی خانواده عمو خاله دایی عمه مادربزرگ پدربزرگ دوست دوستام عروسی تولد maman baba khahar dadash khanevade tavalod`) },
  { key: "tech", label: "Tech", icon: "💻", words: words(`phone laptop computer app apps internet wifi vpn update iphone android mac windows bug server website ai chatgpt
    گوشی لپتاپ کامپیوتر اپ اینترنت وای‌فای فیلترشکن آپدیت سایت هوش goshi laptop internet vpn filtershekan`) },
];

// Languages by letters, with a Finglish hint list for Latin messages.
export const FINGLISH = new Set(words(`salam chetori khubi khoobi merci mersi mamnoon are areh na nemidoonam nemidunam
  midoonam midunam mikham mikhay kheili khayli khili khob khub khoob dige chera chi kojai koja hala alan basheh bashe
  azizam joonam joon jan eshgham delam barat mibinamet bebakhshid berim biya miay miam farda emshab dorost ghorbunet
  ghorboonet bia bego begoo cheshm nemiam nemiay haminjoori hamintori bezar ham ke ro rooz shab sobh`));

// Fight detection. Each hit is weak evidence on its own; a fight needs several kinds at once.
export const FIGHT_RE = new RegExp(
  [
    String.raw`\byou\s+(?:always|never)\b`, String.raw`\bi'?m\s+done\b`, String.raw`\bleave\s+me\s+alone\b`,
    String.raw`\bwhatever\b`, String.raw`\bseriously\b`, String.raw`\bi\s+don'?t\s+care\b`, String.raw`\bforget\s+it\b`,
    String.raw`\bwhat'?s\s+your\s+problem\b`, String.raw`\bstop\s+it\b`, String.raw`\bshut\s+up\b`, String.raw`\bfight(?:ing)?\b`,
    String.raw`\bargu(?:e|ing|ment)\b`, String.raw`\bangry\b`, String.raw`\bmad\s+at\b`, String.raw`\bupset\b`, String.raw`\bhurt\s+me\b`,
    String.raw`\bdisappointed\b`, String.raw`\bunbelievable\b`, String.raw`\bdon'?t\s+talk\s+to\s+me\b`, String.raw`\bwhy\s+would\s+you\b`,
    String.raw`\bnot\s+fair\b`, String.raw`\bi\s+hate\b`, String.raw`\bannoy(?:ed|ing)\b`, String.raw`\bignor(?:e|ed|ing)\s+me\b`,
    String.raw`\bwhy\s+are\s+you\s+like\s+this\b`,
    "ولم\\s*کن", "ولش\\s*کن", "ناراحتم", "دعوا", "همیشه\\s*همین", "هیچوقت", "اعصاب", "حوصله\\s*(?:ندارم|تو\\s*ندارم)",
    "تمومش\\s*کن", "خسته\\s*شدم", "مسخره", "محل\\s*نمیدی", "جواب\\s*نمیدی", "چرا\\s*اینجوری", "حق\\s*نداری", "برو\\s*بابا",
    "بسه\\s*دیگه", "دیگه\\s*بسه", "قهر", "دلخور", "دروغ\\s*گفتی",
    String.raw`\bvel(?:am)?\s+kon\b`, String.raw`\bbikhial\b`, String.raw`\bnarahatam\b`, String.raw`\basabam\b`,
    String.raw`\bhoo?sele\s+nadaram\b`, String.raw`\bghahr\b`, String.raw`\bbase\s+dige\b`, String.raw`\bdige\s+base\b`,
  ].join("|"),
  "iu",
);
// Cold one-word replies (plain "ok" is too common to count).
export const CURT_RE = /^(?:ok\.|okay\.|k\.?|kk\.?|fine\.?|whatever\.?|sure\.|nvm|nothing\.?|ok then\.?|هرچی\.?|باشه\.|اوکی\.|هیچی\.?|بیخیال\.?|عالی\.)$/iu;
