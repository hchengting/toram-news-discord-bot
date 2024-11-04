import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v10'

const { APPLICATION_ID, DISCORD_BOT_TOKEN, DISCORD_PUBLIC_KEY } = process.env

if (!APPLICATION_ID || !DISCORD_BOT_TOKEN || !DISCORD_PUBLIC_KEY) {
    throw new Error('Missing environment variables')
}

const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN)
const options = { headers: { 'content-type': 'application/json' }, passThroughBody: true }

export const registerCommands = (body) => rest.put(Routes.applicationCommands(APPLICATION_ID), { body, ...options })
export const postChannelMessage = (channelId, body) => rest.post(Routes.channelMessages(channelId), { body, ...options })
export const deleteChannelMessage = (channelId, messageId) => rest.delete(Routes.channelMessage(channelId, messageId))
