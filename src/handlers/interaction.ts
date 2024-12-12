import type { APIChatInputApplicationCommandInteraction, APIMessageComponentSelectMenuInteraction, Snowflake } from 'discord-api-types/v10';
import type { Interaction, InteractionResponse, InteractionResponseOptions, InteractionVerificationResult } from '~/types/interaction.d.ts';

import { ComponentType, InteractionResponseType, InteractionType } from 'discord-api-types/v10';
import { verifyKey } from 'discord-interactions';
import { channelSubscribe, channelUnsubscribe, isChannelSubscribed, listChannelSubscriptions } from '~/db/queries.ts';
import { deleteChannelMessage, postChannelMessage } from '~/discord/api.ts';
import commands from '~/discord/commands.ts';
import { categoriesOptions } from '~/helpers/categories.ts';
import { deserialize, logInfo, serialize } from '~/helpers/utils.ts';

const DISCORD_PUBLIC_KEY = Deno.env.get('DISCORD_PUBLIC_KEY');
if (!DISCORD_PUBLIC_KEY) throw new Error('Missing Discord public key.');

async function verifyInteraction(request: Request): Promise<InteractionVerificationResult> {
    if (request.method !== 'POST') {
        return { valid: false, reason: new Response('Method Not Allowed.', { status: 405 }) };
    }

    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    if (!signature || !timestamp) {
        return { valid: false, reason: new Response('Missing signature.', { status: 400 }) };
    }

    const body = await request.text();
    if (!(await verifyKey(body, signature, timestamp, DISCORD_PUBLIC_KEY!))) {
        return { valid: false, reason: new Response('Bad request signature.', { status: 401 }) };
    }

    return { valid: true, interaction: deserialize<Interaction>(body) };
}

async function checkBotPermission(channelId: Snowflake): Promise<boolean> {
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

function createInteractionResponse(options: InteractionResponseOptions): Response {
    const { type = InteractionResponseType.ChannelMessageWithSource, content, components } = options;
    const body = serialize<InteractionResponse>({ type, data: { content, components } });

    return new Response(body, { headers: { 'content-type': 'application/json' } });
}

async function handleSlashCommand(interaction: APIChatInputApplicationCommandInteraction): Promise<Response> {
    const channelId = interaction.channel.id;

    switch (interaction.data.name) {
        // deno-lint-ignore no-case-declarations
        case commands.LIST.name:
            const categories = listChannelSubscriptions(channelId);

            if (!categories.length) {
                logInfo(`Received /list command from channel ${channelId} with no subscriptions.`);
                return createInteractionResponse({ content: '未訂閱！' });
            } else {
                logInfo(`Received /list command from channel ${channelId} with subscriptions: ${categories.join('、')}.`);
                return createInteractionResponse({ content: `已訂閱類別：${categories.join('、')}` });
            }
        case commands.SUBSCRIBE.name:
            if (!(await checkBotPermission(channelId))) {
                logInfo(`Received /subscribe command from channel ${channelId} with insufficient permissions.`);
                return createInteractionResponse({ content: '訂閱失敗！請檢查頻道身分組發送訊息、嵌入連結等相關權限。' });
            } else {
                logInfo(`Received /subscribe command from channel ${channelId}.`);
                return createInteractionResponse({
                    components: [
                        {
                            type: ComponentType.ActionRow,
                            components: [
                                {
                                    type: ComponentType.StringSelect,
                                    custom_id: 'categories',
                                    placeholder: '請選擇訂閱類別',
                                    min_values: 1,
                                    max_values: categoriesOptions.length,
                                    options: categoriesOptions,
                                },
                            ],
                        },
                    ],
                });
            }
        case commands.UNSUBSCRIBE.name:
            if (!isChannelSubscribed(channelId)) {
                logInfo(`Received /unsubscribe command from channel ${channelId} with no subscriptions.`);
                return createInteractionResponse({ content: '未訂閱！' });
            } else {
                channelUnsubscribe(channelId);
                logInfo(`Received /unsubscribe command from channel ${channelId}.`);
                return createInteractionResponse({ content: '取消訂閱成功！' });
            }
        default:
            return createInteractionResponse({ content: '錯誤指令！' });
    }
}

async function handleSelectCategory(interaction: APIMessageComponentSelectMenuInteraction): Promise<Response> {
    const channelId = interaction.channel.id;
    const messageId = interaction.message.id;
    const categories = interaction.data.values;

    await deleteChannelMessage(channelId, messageId);
    channelSubscribe(channelId, categories as Category[]);
    logInfo(`Received category selection from channel ${channelId}: ${categories.join('、')}.`);

    return createInteractionResponse({ content: `訂閱成功！類別：${categories.join('、')}` });
}

// Handle Discord interactions
export default async function handleInteraction(request: Request): Promise<Response> {
    const result = await verifyInteraction(request);
    if (!result.valid) return result.reason;

    const { interaction } = result;
    switch (interaction.type) {
        case InteractionType.Ping:
            return createInteractionResponse({ type: InteractionResponseType.Pong });
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
