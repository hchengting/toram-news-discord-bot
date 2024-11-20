import type {
    RESTDeleteAPIChannelMessageResult,
    RESTPostAPIChannelMessageJSONBody,
    RESTPostAPIChannelMessageResult,
    RESTPutAPIApplicationCommandsJSONBody,
    RESTPutAPIApplicationCommandsResult,
    Snowflake,
} from 'discord-api-types/v10';

import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

const APPLICATION_ID = Deno.env.get('APPLICATION_ID');
if (!APPLICATION_ID) throw new Error('Missing Discord application id.');

const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
if (!DISCORD_BOT_TOKEN) throw new Error('Missing Discord bot token.');

const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

export function registerCommands(body: RESTPutAPIApplicationCommandsJSONBody): Promise<RESTPutAPIApplicationCommandsResult> {
    return rest.put(Routes.applicationCommands(APPLICATION_ID!), { body }) as Promise<RESTPutAPIApplicationCommandsResult>;
}

export function postChannelMessage(
    channelId: Snowflake,
    body: RESTPostAPIChannelMessageJSONBody
): Promise<RESTPostAPIChannelMessageResult> {
    return rest.post(Routes.channelMessages(channelId), { body }) as Promise<RESTPostAPIChannelMessageResult>;
}

export function deleteChannelMessage(channelId: Snowflake, messageId: Snowflake): Promise<RESTDeleteAPIChannelMessageResult> {
    return rest.delete(Routes.channelMessage(channelId, messageId)) as Promise<RESTDeleteAPIChannelMessageResult>;
}
