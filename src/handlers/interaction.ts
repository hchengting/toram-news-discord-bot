import type {
    APIChatInputApplicationCommandInteraction,
    APIInteractionResponse,
    APIMessageComponentSelectMenuInteraction,
} from 'discord-api-types/v10';
import type { Interaction, InteractionResponseParams, VerifyInteraction } from '../types/interaction.d.ts';

import { ComponentType, InteractionResponseType, InteractionType } from 'discord-api-types/v10';
import { verifyKey } from 'discord-interactions';
import { channelSubscribe, channelUnsubscribe, isChannelSubscribed, listChannelSubscriptions } from '../db/queries.ts';
import { deleteChannelMessage, postChannelMessage } from '../discord/api.ts';
import commands from '../discord/commands.ts';
import { categories, componentOptions, sortCategories } from '../helpers/categories.ts';
import { serialize } from '../helpers/utils.ts';

const DISCORD_PUBLIC_KEY = Deno.env.get('DISCORD_PUBLIC_KEY');

if (!DISCORD_PUBLIC_KEY) throw new Error('Missing Discord public key.');

async function verifyInteraction(request: Request): Promise<VerifyInteraction> {
    if (request.method !== 'POST') {
        return { valid: false, clientError: new Response('Method Not Allowed.', { status: 405 }) };
    }

    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');

    if (!signature || !timestamp) {
        return { valid: false, clientError: new Response('Missing signature.', { status: 400 }) };
    }

    const body = await request.text();

    if (!(await verifyKey(body, signature, timestamp, DISCORD_PUBLIC_KEY!))) {
        return { valid: false, clientError: new Response('Bad request signature.', { status: 401 }) };
    }

    try {
        const interaction = JSON.parse(body) as Interaction;
        return { valid: true, interaction };
    } catch (_error) {
        return { valid: false, clientError: new Response('Invalid JSON payload.', { status: 400 }) };
    }
}

async function checkBotPermission(channelId: string): Promise<boolean> {
    try {
        const message = await postChannelMessage(channelId, {
            embeds: [{ title: '處理中', description: '請稍後...', url: 'https://discord.com' }],
        });
        await deleteChannelMessage(channelId, message.id);
        return true;
    } catch (_error) {
        return false;
    }
}

function interactionResponse(params: InteractionResponseParams): Response {
    const { content, components, type = InteractionResponseType.ChannelMessageWithSource } = params;
    const body = serialize<APIInteractionResponse>({ data: { content, components }, type });
    return new Response(body, { headers: { 'content-type': 'application/json' } });
}

async function handleSlashCommand(interaction: APIChatInputApplicationCommandInteraction): Promise<Response> {
    const channelId = interaction.channel.id;

    switch (interaction.data.name) {
        // deno-lint-ignore no-case-declarations
        case commands.LIST.name:
            const subscribedCategories = listChannelSubscriptions(channelId).map((s) => s.category as Category);
            const values = sortCategories(subscribedCategories);

            if (!values.length) {
                return interactionResponse({ content: '未訂閱！' });
            }

            return interactionResponse({ content: `已訂閱類別：${values.join('、')}` });
        case commands.SUBSCRIBE.name:
            if (!(await checkBotPermission(channelId))) {
                return interactionResponse({ content: '訂閱失敗！請檢查發送訊息、嵌入連結等相關權限。' });
            }

            return interactionResponse({
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.StringSelect,
                                custom_id: 'select',
                                placeholder: '請選擇訂閱類別',
                                min_values: 1,
                                max_values: categories.length,
                                options: componentOptions,
                            },
                        ],
                    },
                ],
            });
        case commands.UNSUBSCRIBE.name:
            if (!isChannelSubscribed(channelId)) {
                return interactionResponse({ content: '未訂閱！' });
            }

            channelUnsubscribe(channelId);
            return interactionResponse({ content: '取消訂閱成功！' });
        default:
            return interactionResponse({ content: '錯誤指令！' });
    }
}

async function handleSelectCategory(interaction: APIMessageComponentSelectMenuInteraction): Promise<Response> {
    const channelId = interaction.channel.id;
    const values = sortCategories(interaction.data.values as Category[]);

    channelSubscribe(channelId, values);
    await deleteChannelMessage(channelId, interaction.message.id);

    return interactionResponse({ content: `訂閱成功！類別：${values.join('、')}` });
}

// Handle Discord interactions
export default async function handleInteraction(request: Request): Promise<Response> {
    const req = await verifyInteraction(request);
    if (!req.valid) return req.clientError;

    const { interaction } = req;

    switch (interaction.type) {
        case InteractionType.Ping:
            return interactionResponse({ type: InteractionResponseType.Pong });
        case InteractionType.ApplicationCommand:
            return await handleSlashCommand(interaction);
        case InteractionType.MessageComponent:
            if (interaction.data.component_type === ComponentType.StringSelect) {
                return await handleSelectCategory(interaction);
            }
        /* falls through */
        default:
            return new Response('Bad request.', { status: 400 });
    }
}
