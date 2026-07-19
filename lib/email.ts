/**
 * lib/email.ts
 *
 * Высокоуровневые функции отправки email + HTML-шаблоны.
 * Транспорт (Resend / SMTP) определяется в lib/mailer.ts через env-переменные.
 *
 * Локализация: каждая функция принимает необязательный параметр `locale`
 * ('en' | 'de' | 'ru' | 'ua', по умолчанию 'en'). Передавайте туда язык
 * клиента (client.preferred_language), а если он не задан — язык уведомлений
 * бизнеса (business.notification_language).
 */

import { sendMail, getFromAddress } from './mailer'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export type EmailLocale = 'en' | 'de' | 'ru' | 'ua'

// ─── Translation dictionary ────────────────────────────────────────────────────

const INTL_LOCALE: Record<EmailLocale, string> = {
  en: 'en-US',
  de: 'de-DE',
  ru: 'ru-RU',
  ua: 'uk-UA',
}

const T = {
  en: {
    infoService: 'Service',
    infoDate: 'Date',
    infoTime: 'Time',
    infoEmployee: 'Employee',
    infoAddress: 'Address',
    confirmedTitle: 'Booking confirmed!',
    confirmedGreeting: (name: string) => `Hi ${name}, your appointment is confirmed.`,
    confirmedFooter: 'See you soon!',
    addToCalendar: 'Add to Google Calendar',
    confirmedSubject: (service: string, time: string) => `Booking confirmed — ${service} at ${time}`,
    cancelledTitle: 'Booking cancelled',
    cancelledGreeting: (name: string) => `Hi ${name}, your appointment has been cancelled.`,
    cancelledFooter: (biz: string) => `Contact us if you'd like to rebook — ${biz}`,
    cancelledSubject: (service: string, time: string) => `Booking cancelled — ${service} at ${time}`,
    whenTomorrow: 'tomorrow',
    whenOneHour: 'in 1 hour',
    reminderTitle: (when: string) => `Reminder: your appointment is ${when}`,
    reminderGreeting: (name: string) => `Hi ${name}, just a friendly reminder about your upcoming appointment.`,
    reminderFooter: 'We look forward to seeing you!',
    reminderSubject: (service: string, when: string, time: string) => `Reminder: ${service} ${when} at ${time}`,
    thankYouTitle: 'Thank you for your visit!',
    thankYouGreeting: (name: string, biz: string) => `Hi ${name}, thank you for choosing ${biz}. We hope to see you again!`,
    thankYouVisitedFor: (service: string) => `You were in for: <strong>${service}</strong>`,
    thankYouButton: 'Book your next appointment',
    thankYouSubject: (biz: string) => `Thanks for visiting ${biz}!`,
    reactivationTitle: 'We miss you!',
    reactivationGreeting: (name: string, biz: string) => `Hi ${name}, it's been a while since your last visit to ${biz}.`,
    reactivationBody: "We'd love to see you again. Book your next appointment anytime — it only takes a minute.",
    reactivationButton: 'Book now',
    reactivationSubject: (biz: string) => `${biz} misses you — book your next visit`,
    birthdayTitle: '🎂 Happy Birthday!',
    birthdayGreeting: (name: string, biz: string) => `Hi ${name}, wishing you a wonderful birthday from the whole team at ${biz}!`,
    birthdayBody: 'To celebrate, come in and treat yourself.',
    birthdayButton: 'Book a visit',
    birthdaySubject: (biz: string) => `Happy Birthday from ${biz}! 🎂`,
  },
  de: {
    infoService: 'Dienstleistung',
    infoDate: 'Datum',
    infoTime: 'Uhrzeit',
    infoEmployee: 'Mitarbeiter',
    infoAddress: 'Adresse',
    confirmedTitle: 'Termin bestätigt!',
    confirmedGreeting: (name: string) => `Hallo ${name}, Ihr Termin ist bestätigt.`,
    confirmedFooter: 'Bis bald!',
    addToCalendar: 'Zu Google Kalender hinzufügen',
    confirmedSubject: (service: string, time: string) => `Termin bestätigt — ${service} um ${time}`,
    cancelledTitle: 'Termin abgesagt',
    cancelledGreeting: (name: string) => `Hallo ${name}, Ihr Termin wurde abgesagt.`,
    cancelledFooter: (biz: string) => `Kontaktieren Sie uns, wenn Sie einen neuen Termin buchen möchten — ${biz}`,
    cancelledSubject: (service: string, time: string) => `Termin abgesagt — ${service} um ${time}`,
    whenTomorrow: 'morgen',
    whenOneHour: 'in 1 Stunde',
    reminderTitle: (when: string) => `Erinnerung: Ihr Termin ist ${when}`,
    reminderGreeting: (name: string) => `Hallo ${name}, eine freundliche Erinnerung an Ihren bevorstehenden Termin.`,
    reminderFooter: 'Wir freuen uns auf Sie!',
    reminderSubject: (service: string, when: string, time: string) => `Erinnerung: ${service} ${when} um ${time}`,
    thankYouTitle: 'Danke für Ihren Besuch!',
    thankYouGreeting: (name: string, biz: string) => `Hallo ${name}, danke, dass Sie sich für ${biz} entschieden haben. Wir hoffen, Sie bald wiederzusehen!`,
    thankYouVisitedFor: (service: string) => `Sie waren bei uns für: <strong>${service}</strong>`,
    thankYouButton: 'Nächsten Termin buchen',
    thankYouSubject: (biz: string) => `Danke für Ihren Besuch bei ${biz}!`,
    reactivationTitle: 'Wir vermissen Sie!',
    reactivationGreeting: (name: string, biz: string) => `Hallo ${name}, es ist eine Weile her seit Ihrem letzten Besuch bei ${biz}.`,
    reactivationBody: 'Wir würden uns freuen, Sie wiederzusehen. Buchen Sie jederzeit Ihren nächsten Termin — es dauert nur eine Minute.',
    reactivationButton: 'Jetzt buchen',
    reactivationSubject: (biz: string) => `${biz} vermisst Sie — buchen Sie Ihren nächsten Besuch`,
    birthdayTitle: '🎂 Alles Gute zum Geburtstag!',
    birthdayGreeting: (name: string, biz: string) => `Hallo ${name}, wir wünschen Ihnen einen wunderbaren Geburtstag vom gesamten Team von ${biz}!`,
    birthdayBody: 'Feiern Sie und gönnen Sie sich etwas Gutes.',
    birthdayButton: 'Termin buchen',
    birthdaySubject: (biz: string) => `Alles Gute zum Geburtstag von ${biz}! 🎂`,
  },
  ru: {
    infoService: 'Услуга',
    infoDate: 'Дата',
    infoTime: 'Время',
    infoEmployee: 'Сотрудник',
    infoAddress: 'Адрес',
    confirmedTitle: 'Запись подтверждена!',
    confirmedGreeting: (name: string) => `Привет, ${name}! Ваша запись подтверждена.`,
    confirmedFooter: 'До скорой встречи!',
    addToCalendar: 'Добавить в Google Календарь',
    confirmedSubject: (service: string, time: string) => `Запись подтверждена — ${service} в ${time}`,
    cancelledTitle: 'Запись отменена',
    cancelledGreeting: (name: string) => `Привет, ${name}! Ваша запись была отменена.`,
    cancelledFooter: (biz: string) => `Свяжитесь с нами, если хотите записаться снова — ${biz}`,
    cancelledSubject: (service: string, time: string) => `Запись отменена — ${service} в ${time}`,
    whenTomorrow: 'завтра',
    whenOneHour: 'через 1 час',
    reminderTitle: (when: string) => `Напоминание: ваша запись ${when}`,
    reminderGreeting: (name: string) => `Привет, ${name}! Дружеское напоминание о вашей предстоящей записи.`,
    reminderFooter: 'Ждём вас!',
    reminderSubject: (service: string, when: string, time: string) => `Напоминание: ${service} ${when} в ${time}`,
    thankYouTitle: 'Спасибо за визит!',
    thankYouGreeting: (name: string, biz: string) => `Привет, ${name}! Спасибо, что выбрали ${biz}. Будем рады видеть вас снова!`,
    thankYouVisitedFor: (service: string) => `Вы посетили нас по услуге: <strong>${service}</strong>`,
    thankYouButton: 'Записаться снова',
    thankYouSubject: (biz: string) => `Спасибо за визит в ${biz}!`,
    reactivationTitle: 'Мы скучаем по вам!',
    reactivationGreeting: (name: string, biz: string) => `Привет, ${name}! Прошло уже некоторое время с вашего последнего визита в ${biz}.`,
    reactivationBody: 'Будем рады видеть вас снова. Запишитесь на следующий визит в любое время — это займёт всего минуту.',
    reactivationButton: 'Записаться',
    reactivationSubject: (biz: string) => `${biz} скучает по вам — запишитесь на визит`,
    birthdayTitle: '🎂 С Днём Рождения!',
    birthdayGreeting: (name: string, biz: string) => `Привет, ${name}! Поздравляем с чудесным Днём Рождения от всей команды ${biz}!`,
    birthdayBody: 'В честь праздника — приходите и побалуйте себя.',
    birthdayButton: 'Записаться',
    birthdaySubject: (biz: string) => `С Днём Рождения от ${biz}! 🎂`,
  },
  ua: {
    infoService: 'Послуга',
    infoDate: 'Дата',
    infoTime: 'Час',
    infoEmployee: 'Співробітник',
    infoAddress: 'Адреса',
    confirmedTitle: 'Запис підтверджено!',
    confirmedGreeting: (name: string) => `Привіт, ${name}! Ваш запис підтверджено.`,
    confirmedFooter: 'До зустрічі!',
    addToCalendar: 'Додати до Google Календаря',
    confirmedSubject: (service: string, time: string) => `Запис підтверджено — ${service} у ${time}`,
    cancelledTitle: 'Запис відмінено',
    cancelledGreeting: (name: string) => `Привіт, ${name}! Ваш запис було відмінено.`,
    cancelledFooter: (biz: string) => `Зв'яжіться з нами, якщо хочете записатися знову — ${biz}`,
    cancelledSubject: (service: string, time: string) => `Запис відмінено — ${service} у ${time}`,
    whenTomorrow: 'завтра',
    whenOneHour: 'через 1 годину',
    reminderTitle: (when: string) => `Нагадування: ваш запис ${when}`,
    reminderGreeting: (name: string) => `Привіт, ${name}! Дружнє нагадування про ваш майбутній запис.`,
    reminderFooter: 'Чекаємо на вас!',
    reminderSubject: (service: string, when: string, time: string) => `Нагадування: ${service} ${when} у ${time}`,
    thankYouTitle: 'Дякуємо за візит!',
    thankYouGreeting: (name: string, biz: string) => `Привіт, ${name}! Дякуємо, що обрали ${biz}. Сподіваємось побачити вас знову!`,
    thankYouVisitedFor: (service: string) => `Ви скористались послугою: <strong>${service}</strong>`,
    thankYouButton: 'Записатися знову',
    thankYouSubject: (biz: string) => `Дякуємо за візит до ${biz}!`,
    reactivationTitle: 'Ми за вами скучили!',
    reactivationGreeting: (name: string, biz: string) => `Привіт, ${name}! Минуло вже трохи часу з вашого останнього візиту до ${biz}.`,
    reactivationBody: 'Будемо раді бачити вас знову. Запишіться на новий візит у будь-який час — це займає лише хвилину.',
    reactivationButton: 'Записатися',
    reactivationSubject: (biz: string) => `${biz} чекає на вас — запишіться на новий візит`,
    birthdayTitle: '🎂 З Днем народження!',
    birthdayGreeting: (name: string, biz: string) => `Привіт, ${name}! Вітаємо з чудовим Днем народження від усієї команди ${biz}!`,
    birthdayBody: 'На честь свята — завітайте до нас і потіште себе.',
    birthdayButton: 'Записатися',
    birthdaySubject: (biz: string) => `З Днем народження від ${biz}! 🎂`,
  },
} as const

// ─── Shared layout ────────────────────────────────────────────────────────────

function layout(businessName: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${businessName}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr>
            <td style="background:#2563eb;padding:20px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;">${businessName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Powered by <a href="${APP_URL}" style="color:#2563eb;text-decoration:none;">Pronto</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function btn(text: string, href: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">${text}</a>`
}

function h1(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">${text}</h1>`
}

function p(text: string) {
  return `<p style="margin:8px 0;font-size:15px;color:#374151;line-height:1.6;">${text}</p>`
}

function info(rows: [string, string][]) {
  const cells = rows
      .map(
          ([label, value]) => `
    <tr>
      <td style="padding:8px 12px;font-size:14px;color:#6b7280;width:140px;border-bottom:1px solid #f3f4f6;">${label}</td>
      <td style="padding:8px 12px;font-size:14px;color:#111827;font-weight:500;border-bottom:1px solid #f3f4f6;">${value}</td>
    </tr>`
      )
      .join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">${cells}</table>`
}

// ─── Booking confirmation ─────────────────────────────────────────────────────

export async function sendBookingConfirmation(opts: {
  to: string
  clientName: string
  businessName: string
  serviceName: string
  date: string
  time: string
  employeeName?: string
  address?: string
  calendarUrl?: string
  locale?: EmailLocale
}) {
  const t = T[opts.locale ?? 'en']
  const body = `
    ${h1(t.confirmedTitle)}
    ${p(t.confirmedGreeting(firstName(opts.clientName)))}
    ${info([
    [t.infoService, opts.serviceName],
    [t.infoDate, opts.date],
    [t.infoTime, opts.time],
    ...(opts.employeeName ? [[t.infoEmployee, opts.employeeName] as [string, string]] : []),
    ...(opts.address ? [[t.infoAddress, opts.address] as [string, string]] : []),
  ])}
    ${p(t.confirmedFooter)}
    ${opts.calendarUrl ? p(`<a href="${opts.calendarUrl}" style="color:#2563eb;">${t.addToCalendar}</a>`) : ''}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: t.confirmedSubject(opts.serviceName, opts.time),
    html: layout(opts.businessName, body),
  })
}

// ─── Booking reschedule ─────────────────────────────────────────────────────

export async function sendBookingReschedule(opts: {
  to: string
  clientName: string
  businessName: string
  serviceName: string
  newDate: string
  newTime: string
  employeeName?: string
}) {
  const body = `
    ${h1('Booking rescheduled')}
    ${p(`Hi ${firstName(opts.clientName)}, your appointment has been moved to a new time.`)}
    ${info([
    ['Service', opts.serviceName],
    ['New date', opts.newDate],
    ['New time', opts.newTime],
    ...(opts.employeeName ? [['Employee', opts.employeeName] as [string, string]] : []),
  ])}
    ${p(`See you then — ${opts.businessName}`)}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: `Booking rescheduled — ${opts.serviceName} now at ${opts.newTime}`,
    html: layout(opts.businessName, body),
  })
}

// ─── Cancellation ─────────────────────────────────────────────────────────────

export async function sendBookingCancellation(opts: {
  to: string
  clientName: string
  businessName: string
  serviceName: string
  date: string
  time: string
  employeeName?: string
  locale?: EmailLocale
}) {
  const t = T[opts.locale ?? 'en']
  const body = `
    ${h1(t.cancelledTitle)}
    ${p(t.cancelledGreeting(firstName(opts.clientName)))}
    ${info([
    [t.infoService, opts.serviceName],
    [t.infoDate, opts.date],
    [t.infoTime, opts.time],
    ...(opts.employeeName ? [[t.infoEmployee, opts.employeeName] as [string, string]] : []),
  ])}
    ${p(t.cancelledFooter(opts.businessName))}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: t.cancelledSubject(opts.serviceName, opts.time),
    html: layout(opts.businessName, body),
  })
}

// ─── Reminder ─────────────────────────────────────────────────────────────────

export async function sendReminder(opts: {
  to: string
  clientName: string
  businessName: string
  serviceName: string
  date: string
  time: string
  employeeName?: string
  address?: string
  isOneHour?: boolean
  locale?: EmailLocale
}) {
  const t = T[opts.locale ?? 'en']
  const when = opts.isOneHour ? t.whenOneHour : t.whenTomorrow
  const body = `
    ${h1(t.reminderTitle(when))}
    ${p(t.reminderGreeting(firstName(opts.clientName)))}
    ${info([
    [t.infoService, opts.serviceName],
    [t.infoDate, opts.date],
    [t.infoTime, opts.time],
    ...(opts.employeeName ? [[t.infoEmployee, opts.employeeName] as [string, string]] : []),
    ...(opts.address ? [[t.infoAddress, opts.address] as [string, string]] : []),
  ])}
    ${p(t.reminderFooter)}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: t.reminderSubject(opts.serviceName, when, opts.time),
    html: layout(opts.businessName, body),
  })
}

// ─── Thank-you ────────────────────────────────────────────────────────────────

export async function sendThankYou(opts: {
  to: string
  clientName: string
  businessName: string
  serviceName: string
  bookingUrl?: string
  locale?: EmailLocale
}) {
  const t = T[opts.locale ?? 'en']
  const body = `
    ${h1(t.thankYouTitle)}
    ${p(t.thankYouGreeting(firstName(opts.clientName), opts.businessName))}
    ${p(t.thankYouVisitedFor(opts.serviceName))}
    ${opts.bookingUrl ? btn(t.thankYouButton, opts.bookingUrl) : ''}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: t.thankYouSubject(opts.businessName),
    html: layout(opts.businessName, body),
  })
}

// ─── Re-activation ────────────────────────────────────────────────────────────

export async function sendReactivation(opts: {
  to: string
  clientName: string
  businessName: string
  bookingUrl?: string
  locale?: EmailLocale
}) {
  const t = T[opts.locale ?? 'en']
  const body = `
    ${h1(t.reactivationTitle)}
    ${p(t.reactivationGreeting(firstName(opts.clientName), opts.businessName))}
    ${p(t.reactivationBody)}
    ${opts.bookingUrl ? btn(t.reactivationButton, opts.bookingUrl) : ''}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: t.reactivationSubject(opts.businessName),
    html: layout(opts.businessName, body),
  })
}

// ─── Birthday ─────────────────────────────────────────────────────────────────

export async function sendBirthday(opts: {
  to: string
  clientName: string
  businessName: string
  bookingUrl?: string
  locale?: EmailLocale
}) {
  const t = T[opts.locale ?? 'en']
  const body = `
    ${h1(t.birthdayTitle)}
    ${p(t.birthdayGreeting(firstName(opts.clientName), opts.businessName))}
    ${p(t.birthdayBody)}
    ${opts.bookingUrl ? btn(t.birthdayButton, opts.bookingUrl) : ''}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: t.birthdaySubject(opts.businessName),
    html: layout(opts.businessName, body),
  })
}

// ─── Low-stock alert ──────────────────────────────────────────────────────────
// Unused since the inventory module was removed. Kept only in case a future
// version of the app re-adds stock tracking; not localized.

export async function sendLowStockAlert(opts: {
  to: string
  businessName: string
  items: { name: string; quantity: number; unit: string; threshold: number }[]
}) {
  const rows = opts.items.map(
      (i) => [i.name, `${i.quantity} ${i.unit} (threshold: ${i.threshold})`] as [string, string]
  )
  const body = `
    ${h1('Low-stock alert')}
    ${p(`The following items in ${opts.businessName} are running low:`)}
    ${info(rows)}
    ${btn('Go to Inventory', `${APP_URL}/inventory`)}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: `Low-stock alert — ${opts.items.length} item${opts.items.length > 1 ? 's' : ''} running low`,
    html: layout(opts.businessName, body),
  })
}

// ─── Name helpers ─────────────────────────────────────────────────────────────

/** "KONSTANTIN UMNOV" → "Konstantin Umnov", "kostya" → "Kostya" */
function toTitleCase(name: string): string {
  return name
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** "Konstantin Umnov" → "Konstantin", "kostya" → "Kostya" */
function firstName(name: string): string {
  return toTitleCase(name).split(/\s+/)[0]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatEmailDate(iso: string, timezone = 'UTC', locale: EmailLocale = 'en') {
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: timezone,
  })
}

export function formatEmailTime(iso: string, timezone = 'UTC', locale: EmailLocale = 'en') {
  return new Date(iso).toLocaleTimeString(INTL_LOCALE[locale], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  })
}