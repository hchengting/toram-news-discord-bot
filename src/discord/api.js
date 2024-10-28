import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v10'
import { command } from '../consts.js'

const APPLICATION_ID = process.env.APPLICATION_ID
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY

if (!APPLICATION_ID || !DISCORD_BOT_TOKEN || !DISCORD_PUBLIC_KEY) {
    throw new Error('Missing environment variables')
}

const discordAPI = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN)

;(async function () {
    await discordAPI.put(Routes.applicationCommands(APPLICATION_ID), { body: Object.values(command) })
})()

export default discordAPI
