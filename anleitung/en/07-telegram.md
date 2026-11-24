# Messages via Telegram

A session that works for a long time can report its result to you instead of writing it silently into the terminal. Without Telegram the message appears as a notification on this machine; with Telegram it reaches your phone.

## Setting up

1. Create a bot with `@BotFather` in Telegram. You receive a token.
2. Write your bot a message once. Otherwise it may not write to you.
3. Ask `@userinfobot`, for example, for your id. The number is meant, not the name of the bot.
4. Open **{{ui.einstellungen}}**, section **{{ui.einst.telegram}}**, enter token and chat id and save.
5. **{{ui.einst.telegramProbe}}** sends a message as a test. If it does not arrive, the deck names the reason.

## Using it

The session calls `coop melden "<one or two sentences>"`. The briefing tells it that this way exists. The message carries the project and the name of the session.

What a session reports goes to Telegram and thereby leaves this machine. Each session may send at most 20 messages per hour.
