import { verifyKey } from 'discord-interactions'
import { Routes, InteractionType, InteractionResponseType, ComponentType } from 'discord-api-types/v10'
import { categories, componentOptions, command } from '../consts.js'
import discordAPI from '../discord/api.js'
import query from '../db/query.js'

async function verifyInteraction(request) {
    const chunks = []

    for await (const chunk of request) {
        chunks.push(chunk)
    }

    const body = Buffer.concat(chunks).toString()
    const signature = request.headers['x-signature-ed25519']
    const timestamp = request.headers['x-signature-timestamp']
    const valid = await verifyKey(body, signature, timestamp, process.env.DISCORD_PUBLIC_KEY)
    const interaction = JSON.parse(body)

    return {
        valid,
        interaction,
    }
}

async function checkBotPermission(channelId) {
    try {
        const message = await discordAPI.post(Routes.channelMessages(channelId), {
            body: {
                embeds: [
                    {
                        title: '處理中',
                        description: '請稍後...',
                        url: 'https://discord.com',
                    },
                ],
            },
        })
        await discordAPI.delete(Routes.channelMessage(channelId, message.id))

        return true
    } catch (error) {
        return false
    }
}

// Handle Discord interactions
export default async function interaction(request) {
    if (request.method !== 'POST') {
        return { status: 405, body: 'Method Not Allowed.' }
    }

    const { valid, interaction } = await verifyInteraction(request)

    if (!valid) {
        return { status: 401, body: 'Bad request signature.' }
    }

    const InteractionResponse = ({ content, components, type = InteractionResponseType.ChannelMessageWithSource }) => ({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: { content, components }, type }),
    })

    if (interaction.type === InteractionType.Ping) {
        return InteractionResponse({ type: InteractionResponseType.Pong })
    }

    if (interaction.type === InteractionType.ApplicationCommand) {
        const channelId = interaction.channel.id
        let content = ''

        switch (interaction.data.name) {
            case command.SUBSCRIBE.name:
                if (!(await checkBotPermission(channelId))) {
                    content = '訂閱失敗！請檢查發送訊息、嵌入連結等相關權限。'
                    break
                }

                return InteractionResponse({
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
            case command.UNSUBSCRIBE.name:
                if (!query.isChannelSubscribed(channelId)) {
                    content = '未訂閱！'
                } else {
                    query.channelUnsubscribe(channelId)
                    content = '取消訂閱成功！'
                }
                break
        }

        return InteractionResponse({ content })
    }

    if (interaction.type === InteractionType.MessageComponent && interaction.data.component_type === ComponentType.StringSelect) {
        const values = interaction.data.values.sort((a, b) => categories.indexOf(a) - categories.indexOf(b))

        query.channelSubscribe(interaction.channel.id, values)
        await discordAPI.delete(Routes.channelMessage(interaction.channel.id, interaction.message.id))

        return InteractionResponse({ content: `訂閱成功！類別：${values.join('、')}` })
    }

    return { status: 400, body: 'Bad request.' }
}
