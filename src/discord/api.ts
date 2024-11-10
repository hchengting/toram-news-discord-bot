import { Routes } from 'discord-api-types/v10';
import { REST } from '@discordjs/rest';

import type {
    APIMessage,
    APIApplicationCommand,
    RESTPostAPIChannelMessageJSONBody,
    RESTPutAPIApplicationCommandsJSONBody,
} from 'discord-api-types/v10';

const { APPLICATION_ID, DISCORD_BOT_TOKEN } = process.env;

if (!APPLICATION_ID) throw new Error('Missing Discord application ID.');
if (!DISCORD_BOT_TOKEN) throw new Error('Missing Discord bot token.');

const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);
const options = { headers: { 'content-type': 'application/json' }, passThroughBody: true };

export function registerCommands(body: RESTPutAPIApplicationCommandsJSONBody): Promise<APIApplicationCommand[]> {
    return rest.put(Routes.applicationCommands(APPLICATION_ID!), { body }) as Promise<APIApplicationCommand[]>;
}

export function postChannelMessage(channelId: string, body: string): Promise<APIMessage>;
export function postChannelMessage(channelId: string, body: RESTPostAPIChannelMessageJSONBody): Promise<APIMessage>;
export function postChannelMessage(channelId: string, body: string | RESTPostAPIChannelMessageJSONBody): Promise<APIMessage> {
    if (typeof body === 'string') {
        return rest.post(Routes.channelMessages(channelId), { body, ...options }) as Promise<APIMessage>;
    } else {
        return rest.post(Routes.channelMessages(channelId), { body }) as Promise<APIMessage>;
    }
}

export function deleteChannelMessage(channelId: string, messageId: string): Promise<{}> {
    return rest.delete(Routes.channelMessage(channelId, messageId)) as Promise<{}>;
}