# Toram News Discord Bot

This Discord bot regularly fetches announcements from https://tw.toram.jp/information and sends them to the Discord channel.

## Setup Discord Bot

Follow [Setting up a bot application | discord.js Guide (discordjs.guide)](https://discordjs.guide/preparations/setting-up-a-bot-application.html) to create your Discord bot.

### Change Default Install Settings

Go to [Discord Developer Portal — My Applications](https://discord.com/developers/applications).

Click on your bot application and open the Installation page.

Select `Guild Install`.

Select the `bot` scope.

Select `Embed Links`, `Send Messages` permissions.

![image](https://github.com/user-attachments/assets/b10f9f8a-5734-44bf-8272-1c91477cd8d7)

### Invite Bot to Server

Invite bot to the server by visiting the install link.

### Change Interactions Endpoint URL

Go to [Discord Developer Portal — My Applications](https://discord.com/developers/applications).

Click on your bot application and open the General Information page.

Configure your own interaction endpoint URL.

![image](https://github.com/user-attachments/assets/b50da751-f31b-45bd-82f2-7bf30b762b86)

## How to Run

### Environment Variables

Rename `.env.example` to `.env` and fill in your own.

```env
APPLICATION_ID=
DISCORD_BOT_TOKEN=
DISCORD_PUBLIC_KEY=
```

### Run Docker Container

```bash
mkdir data
docker run -d --name toram-news-discord-bot --restart always --memory 256m --env-file .env -p 127.0.0.1:3000:3000 -v ./data:/app/data ghcr.io/hchengting/toram-news-discord-bot
```

## Subscribe to Toram News

Use `/subscribe` command in the channel.

![image](https://github.com/user-attachments/assets/dcb8a948-b47a-4b4e-94ca-3b19d8770742)

## References

-   [Welcome to Cheerio! | cheerio](https://cheerio.js.org/docs/intro)
-   [html-to-text - npm](https://www.npmjs.com/package/html-to-text)
-   [@discordjs/rest](https://discord.js.org/docs/packages/rest/main)
