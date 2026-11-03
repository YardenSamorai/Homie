# יומנים מחוברים: הגדרה והפעלה

הומי קורא אירועים מ־Google Calendar ומ־Outlook / Microsoft 365, לקריאה בלבד. שום דבר ביומן המקורי לא נוצר, משתנה או נמחק. האיפיון המלא נמצא בסעיף 6.8 של `docs/SPEC.md`.

עד שכל ההגדרות למטה קיימות בשרת, כפתורי החיבור בהגדרות מושבתים ומוצג "חיבור יומנים עוד לא הוגדר". בסביבת פיתוח מוצגים גם שמות המשתנים החסרים.

## 1. מסד הנתונים

1. להריץ את `supabase/migrations/0013_today_and_calendars.sql` פעם אחת ב־SQL editor (אחרי 0012, אם עוד לא הורץ).
2. מה נוצר: פתק הבית (`house_notes`), חשבונות ויומנים (`calendar_accounts`, `calendar_sources`), אירועים מיובאים (`calendar_events`), תיקונים מקומיים (`calendar_event_fixes`), מצב סנכרון (`calendar_sync_state`) וטוקנים מוצפנים (`calendar_secrets`).
3. משתמש מחובר לא יכול לקרוא את `calendar_secrets`, `calendar_sync_state` או `calendar_event_fixes`, ולא לכתוב לטבלאות היומן. כל הקריאה עוברת דרך `house_calendar`, שמסננת לפי הפרטיות של כל יומן.

## 2. משתני סביבה (Vercel, שרת בלבד)

| משתנה | מה זה |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | מ־Supabase → Project Settings → API. השרת משתמש בו כדי לשמור טוקנים ולסנכרן. |
| `CALENDAR_TOKEN_KEY` | ‏32 בתים אקראיים ב־base64: `openssl rand -base64 32`. מצפין את הטוקנים (AES-256-GCM) ואת עוגיית ה־OAuth. החלפה שלו מבקשת מכל החשבונות להתחבר מחדש. |
| `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET` | מ־Google Cloud (סעיף 3). |
| `MICROSOFT_CALENDAR_CLIENT_ID` / `MICROSOFT_CALENDAR_CLIENT_SECRET` | מ־Microsoft Entra (סעיף 4). |
| `MICROSOFT_CALENDAR_TENANT` | אופציונלי. ברירת המחדל `common`: חשבונות עבודה, לימודים ואישיים. |
| `CALENDAR_REDIRECT_ORIGIN` | אופציונלי. הכתובת הציבורית שאליה רשומות כתובות החזרה, למשל `https://homie-taupe.vercel.app`. ברירת המחדל: הכתובת של הבקשה. |
| `CRON_SECRET` | כבר קיים לסיכום הבוקר. משמש גם את `/api/cron/calendars`. |

אף אחד מהם לא מתחיל ב־`NEXT_PUBLIC_` ואף אחד לא מגיע לדפדפן.

## 3. Google Calendar

1. ב־[Google Cloud Console](https://console.cloud.google.com/): פרויקט, ואז APIs & Services → Library → להפעיל את **Google Calendar API**.
2. OAuth consent screen (Google Auth Platform):
   - סוג External, שם האפליקציה, אימייל תמיכה, קישור למדיניות הפרטיות (`/he/privacy`).
   - Scopes: `openid`, `email`, `https://www.googleapis.com/auth/calendar.calendarlist.readonly`, `https://www.googleapis.com/auth/calendar.events.readonly`. אלה ההרשאות הצרות ביותר שמספיקות לרשימת היומנים ולקריאת האירועים. אין גישה ל־Gmail.
3. Credentials → Create OAuth client ID → Web application. Authorized redirect URIs:
   - `https://<האתר>/api/calendars/callback/google`
   - לפיתוח: `http://localhost:3000/api/calendars/callback/google`
4. מגבלות שכדאי לדעת:
   - במצב **Testing** רק משתמשי בדיקה שהוספתם יכולים להתחבר, ו־Google מבטלת את ה־refresh token אחרי 7 ימים. אז החשבון יופיע אצלכם כ"צריך להתחבר מחדש".
   - ה־scopes של היומן מוגדרים אצל Google כרגישים, ולכן פרסום לכלל המשתמשים דורש אימות של Google.
   - Google חוסמת התחברות בתוך WebView משובץ, ולכן באפליקציית ה־iPhone כפתור Google מושבת עם הסבר. מהדפדפן זה עובד.
5. בניתוק הומי קורא ל־`oauth2.googleapis.com/revoke`, כך שההרשאה נמחקת גם אצל Google.

## 4. Outlook / Microsoft 365

1. ב־[Microsoft Entra admin center](https://entra.microsoft.com/): App registrations → New registration.
   - Supported account types: חשבונות בכל ארגון וגם חשבונות Microsoft אישיים (מתאים ל־`common`).
   - Redirect URI מסוג **Web**: `https://<האתר>/api/calendars/callback/microsoft` (ולפיתוח `http://localhost:3000/api/calendars/callback/microsoft`).
2. Certificates & secrets → New client secret. הערך הוא `MICROSOFT_CALENDAR_CLIENT_SECRET`. יש לו תאריך תפוגה, ולפניו צריך ליצור חדש.
3. API permissions → Microsoft Graph → Delegated: `openid`, `email`, `offline_access`, `User.Read`, `Calendars.Read`. בלי `Mail.*`.
4. בארגונים שבהם המנהל חוסם הסכמה של משתמשים, ההתחברות תיכשל עם הודעה מתאימה עד שהמנהל יאשר את האפליקציה.
5. ל־Microsoft אין נקודת ביטול טוקן לאפליקציה. בניתוק הומי מוחק את הטוקנים ואת כל מה שיובא. כדי להסיר גם את ההסכמה עצמה, המשתמש מסיר את הומי ב־[myapplications.microsoft.com](https://myapplications.microsoft.com/) (חשבון עבודה) או ב־[account.live.com/consent/Manage](https://account.live.com/consent/Manage) (חשבון אישי).

## 5. סנכרון

- **חלון:** 14 יום אחורה ו־120 יום קדימה. מעבר לזה היומן בהומי אומר עד איזה תאריך האירועים נטענו.
- **שינויים בלבד:** Google עם `syncToken`; Microsoft עם `calendarView/delta`. פעם בשבוע, או כשהספק מבטל את הסמן (Google ‏410), נקרא החלון כולו מחדש.
- **מתי:** כשפותחים את האפליקציה ועברו יותר מ־10 דקות מהסנכרון האחרון, בלחיצה על "סנכרון עכשיו", ובשקט כל 15 דקות דרך `.github/workflows/calendars.yml`. ה־workflow קורא ל־`/api/cron/calendars` עם `CRON_SECRET` כסוד של GitHub. מסך "היום" טוען מחדש את מה שכבר סונכרן כל 5 דקות.
- **כשל חלקי לא מוחק:** אירוע נמחק רק כשהספק אומר שבוטל, או אחרי קריאה מלאה ומוצלחת של החלון. קריאה שנקטעה באמצע לא מוחקת כלום.
- **שגיאות:** טוקן שפג מתחדש אוטומטית. Refresh token שבוטל או הרשאה שהוסרה מסמנים את החשבון "צריך להתחבר מחדש". הגבלת קצב (429) מכבדת את `Retry-After`. יומן שנמחק במקור מסומן "היומן הזה כבר לא קיים בחשבון".
- **זהות:** כל אירוע נשמר לפי מזהה הספק, היומן ומזהה המופע (מופע של אירוע חוזר נשמר לחוד). אותה פגישה משני חשבונות מתאחדת רק כשה־`iCalUID` ושעת ההתחלה זהים, ובתצוגה בלבד. כותרת ושעה דומות לבד לא מאחדות.

## 6. פרטיות

- לכל יומן בוחרים במפורש: **פרטי** (ברירת המחדל, בני הבית לא רואים כלום), **זמינות בלבד** (רק "זמן תפוס"), או **פרטים מלאים** (כותרת, שעה ומשתתפים).
- אירוע שסומן במקור כפרטי או חסוי מוצג לבני הבית כזמן תפוס, גם ביומן עם פרטים מלאים.
- הסינון נעשה בשרת (`house_calendar`). פרטים אסורים לא נשלחים לדפדפן, לא נכנסים לפעילות, להתראות או למשפט של היום.
- יציאה מהבית או הסרה ממנו מוחקת את כל מה שאותו אדם ייבא אל הבית.

## 7. מה עוד לא נבדק

- חיבור אמיתי לחשבונות Google ו־Microsoft וסנכרון חי לא נבדקו, כי אין עדיין פרטי OAuth. הלוגיקה נבדקה בבדיקות יחידה ובבדיקות SQL, והממשק נבדק במצב הדגמה.
- Slack: בשלב מאוחר יותר. בהגדרות מוצג "בהמשך" בלי כפתור.
