import { ComponentType, InteractionResponseType, InteractionType } from 'discord-api-types/v10'
import { verifyKey } from 'discord-interactions'
import { channelSubscribe, channelUnsubscribe, isChannelSubscribed, listChannelSubscriptions } from '../db/queries.js'
import { deleteChannelMessage, postChannelMessage } from '../discord/api.js'
import commands from '../discord/commands.js'
import { categories, componentOptions, sortCategories } from '../helpers/consts.js'

async function verifyInteraction(request) {
    if (request.method !== 'POST') {
        return { clientError: { status: 405, body: 'Method Not Allowed.' } }
    }

    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = Buffer.concat(chunks).toString()
    const { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp } = request.headers

    if (!(await verifyKey(body, signature, timestamp, process.env.DISCORD_PUBLIC_KEY))) {
        return { clientError: { status: 401, body: 'Bad request signature.' } }
    }

    return { interaction: JSON.parse(body) }
}

async function checkBotPermission(channelId) {
    try {
        const message = await postChannelMessage(
            channelId,
            JSON.stringify({ embeds: [{ title: '處理中', description: '請稍後...', url: 'https://discord.com' }] })
        )
        await deleteChannelMessage(channelId, message.id)
        return true
    } catch (error) {
        return false
    }
}

const interactionResponse = ({ content, components, type = InteractionResponseType.ChannelMessageWithSource }) => ({
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: { content, components }, type }),
})

async function handleSlashCommand(interaction) {
    const channelId = interaction.channel.id

    switch (interaction.data.name) {
        case commands.LIST.name:
            const values = sortCategories(listChannelSubscriptions(channelId).map((s) => s.category))

            if (!values.length) {
                return interactionResponse({ content: '未訂閱！' })
            }

            return interactionResponse({ content: `已訂閱類別：${values.join('、')}` })
        case commands.SUBSCRIBE.name:
            if (!(await checkBotPermission(channelId))) {
                return interactionResponse({ content: '訂閱失敗！請檢查發送訊息、嵌入連結等相關權限。' })
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
            })
        case commands.UNSUBSCRIBE.name:
            if (!isChannelSubscribed(channelId)) {
                return interactionResponse({ content: '未訂閱！' })
            }

            channelUnsubscribe(channelId)
            return interactionResponse({ content: '取消訂閱成功！' })
        default:
            return interactionResponse({ content: '錯誤指令！' })
    }
}

async function handleSelectCategory(interaction) {
    const channelId = interaction.channel.id
    const values = sortCategories(interaction.data.values)

    channelSubscribe(channelId, values)
    await deleteChannelMessage(channelId, interaction.message.id)

    return interactionResponse({ content: `訂閱成功！類別：${values.join('、')}` })
}

// Handle Discord interactions
export default async function handleInteraction(request) {
    const { clientError, interaction } = await verifyInteraction(request)
    if (clientError) return clientError

    switch (interaction.type) {
        case InteractionType.Ping:
            return interactionResponse({ type: InteractionResponseType.Pong })
        case InteractionType.ApplicationCommand:
            return await handleSlashCommand(interaction)
        case InteractionType.MessageComponent:
            if (interaction.data.component_type === ComponentType.StringSelect) {
                return await handleSelectCategory(interaction)
            }
        default:
            return { status: 400, body: 'Bad request.' }
    }
}
