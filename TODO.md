# Pronto — TODO

## Instagram Direct — полноценная автоматизация
Сейчас Instagram — просто контактное поле в карточке клиента (введено вручную,
никуда не отправляется автоматически).

Полноценная интеграция (как у Telegram/Viber/WhatsApp — автоматические
подтверждения записи, напоминания, уведомления об отмене прямо в Instagram Direct)
требует отдельной работы:

- [ ] Instagram Business-аккаунт, привязанный к Facebook Page
- [ ] Meta App с продуктом **Instagram Messaging API** (отдельно от WhatsApp Cloud API)
- [ ] Разрешения: `instagram_basic`, `instagram_manage_messages`, `pages_messaging`
- [ ] App Review в Meta для этих разрешений (публичный запуск требует проверки Meta,
  это может занять от нескольких дней до пары недель)
- [ ] Webhook для приёма сообщений (аналог `/api/telegram/webhook`, `/api/viber/webhook`)
- [ ] Матчинг клиента по Instagram-профилю при первом сообщении в Direct
  (аналог `?start=client_<id>` у Telegram — у Instagram свой механизм,
  обычно через ice-breaker/postback или ручную привязку)
- [ ] `lib/instagram.ts` — отправка сообщений, шаблоны (по аналогии с `lib/whatsapp.ts`)
- [ ] Подключение в Settings → Notifications (аналогично блоку WhatsApp)
- [ ] Прокинуть в `/api/email/confirm` и `/api/email/cancel` как ещё один канал

**Оценка сложности:** сопоставимо с тем, что мы делали для WhatsApp, но плюс
процесс App Review в Meta — это самая долгая часть (не зависит от кода, зависит
от модерации Meta).

---

## (Add new)