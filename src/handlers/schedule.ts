import { DiscordAPIError } from '@discordjs/rest';
import { getImageInfo } from '@retraigo/image-size';
import * as cheerio from 'cheerio';
import { htmlToText } from 'html-to-text';
import {
    channelUnsubscribe,
    deletePendingMessage,
    deletePostMessages,
    listLatestNews,
    listPostMessages,
    resetPendingMessage,
    retrievePendingMessages,
    updateLatestNews,
} from '~/db/queries.ts';
import { postChannelMessage } from '~/discord/api.ts';
import { extractCategory } from '~/helpers/categories.ts';
import formatters from '~/helpers/formatters.ts';
import { deserialize, logError, logInfo, serialize } from '~/helpers/utils.ts';

const url = 'https://tw.toram.jp/information';
const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
};

async function fetchNews(): Promise<News[]> {
    const response = await fetch(url, { headers });
    if (response.status !== 200) {
        throw new Error(`Failed to fetch ${url}, status code: ${response.status}`);
    }

    const $ = cheerio.load(await response.text(), { baseURI: url });
    const data = $('div.useBox > ul').extract({
        news: [
            {
                selector: 'li.news_border',
                value: (el) => {
                    const $el = $(el);
                    return {
                        date: $el.find('time').attr('datetime') || '',
                        category: extractCategory($el.find('img').prop('src')),
                        title: $el.find('p.news_title').text() || '',
                        url: $el.find('a').prop('href') || '',
                        thumbnail: $el.find('img').prop('src') || '',
                    };
                },
            },
        ],
    });

    return data.news.reverse();
}

function checkNewsDifference(news: News[]): NewsDifference {
    const latestNews = listLatestNews();
    const latestNewsSet = new Set(latestNews.map((n) => serialize<News>(n)));
    const newsSet = new Set(news.map((n) => serialize<News>(n)));
    const deletions = [...latestNewsSet.difference(newsSet)].map((n) => deserialize<News>(n));
    const updates = [...newsSet.difference(latestNewsSet)].map((n) => deserialize<News>(n));

    return { deletions, updates };
}

async function fetchImageInfo(url: string): Promise<ImageInfo> {
    const response = await fetch(url, { headers });
    if (response.status !== 200 || !response.body) return { url };

    const reader = response.body.getReader();
    let chunks = new Uint8Array();
    let width, height;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const newChunks = new Uint8Array(chunks.length + value.length);
        newChunks.set(chunks);
        newChunks.set(value, chunks.length);
        chunks = newChunks;

        const info = getImageInfo(chunks);
        if (info.width && info.height) {
            ({ width, height } = info);
            await reader.cancel();
            break;
        }
    }

    return { url, width, height };
}

async function createPostMessage(news: News): Promise<PostMessage> {
    logInfo(`Creating post message for ${news.title}...`);

    const message: PostMessage = {
        body: {
            embeds: [],
        },
        category: news.category,
    };

    // Fetch news content
    const response = await fetch(news.url, { headers });
    if (response.status !== 200) {
        throw new Error(`Failed to fetch ${news.url}, status code: ${response.status}`);
    }

    // Parse news content
    const $ = cheerio.load(await response.text(), { baseURI: news.url });
    const $container = $('div.useBox.newsBox');
    let $contents = $container.contents();
    let start = $contents.index($container.find('div.smallTitleLine'));
    let end = $contents.index($container.find('h2.deluxetitle:contains("注意事項")'));
    if (end === -1) end = $contents.length;

    // Remove unwant elements
    $contents.each((i, el) => {
        const $el = $(el);
        if (i <= start || i >= end) {
            $el.remove();
        } else if ($el.is('a') && $el.text() === '注意事項' && $contents.eq(i - 1).text() === '\n・') {
            $contents.eq(i - 1).remove();
            $el.remove();
        }
    });
    $container.find('a:contains("回頁面頂端")').remove();
    $container.find('h2.deluxetitle:contains("指定怪物")').nextAll('br').remove();

    // Resolve relative href
    $container.find('a').each((_i, el) => {
        $(el).attr('href', $(el).prop('href'));
    });

    // Update contents
    $contents = $container.contents();

    // Split into sections by deluxe titles
    const $deluxeTitles = $container.find('h2.deluxetitle[id]');
    const sectionIndexs = [0, ...$deluxeTitles.map((_i, el) => $contents.index(el)).toArray(), $contents.length];

    for (let i = 0; i < sectionIndexs.length - 1; i++) {
        const $section = $contents.slice(sectionIndexs[i] + 1, sectionIndexs[i + 1]);
        const title = i === 0 ? news.title : $deluxeTitles.eq(i - 1).text();
        const url = i === 0 ? news.url : `${news.url}#${$deluxeTitles.eq(i - 1).attr('id')}`;
        const thumbnail = i === 0 ? { url: news.thumbnail } : undefined;

        // Convert section html to text
        const description = htmlToText($.html($section), {
            wordwrap: false,
            formatters,
            selectors: [
                { selector: 'a', format: 'formatAnchor' },
                { selector: 'table.u-table--simple', format: 'formatTable' },
                { selector: 'hr', format: 'skip' },
                { selector: 'img', format: 'skip' },
                { selector: 'button', format: 'skip' },
                { selector: 'div[align=center]', format: 'skip' },
                { selector: 'del', format: 'inlineSurround', options: { prefix: '~~', suffix: '~~' } },
                { selector: 'font', format: 'inlineSurround', options: { prefix: '**', suffix: '**' } },
                { selector: 'span', format: 'inlineSurround', options: { prefix: '**', suffix: '**' } },
                { selector: 'strong', format: 'inlineSurround', options: { prefix: '**', suffix: '**' } },
                { selector: 'div.subtitle', format: 'inlineSurround', options: { prefix: '**✿ ', suffix: '**\n' } },
                { selector: 'h2.deluxetitle', format: 'inlineSurround', options: { prefix: '### ➤ ', suffix: '\n' } },
            ],
        }).replace(/\n{3,}/g, '\n\n');

        // Extract images from this section
        const images = $section
            .map((_i, el) => $(el).filter('img').add($(el).find('img')).toArray())
            .toArray()
            .flat()
            .map((el) => ({ url: $(el).prop('src') || '' }));

        // Add section data and the first image to embeds
        message.body.embeds.push({
            title: title.slice(0, 128),
            url,
            thumbnail,
            description: description.slice(0, 2048),
            image: images.shift(),
        });

        // Add remaining images to embeds using same url to display as gallery
        message.body.embeds.push(...images.map((img) => ({ url, image: img })));
    }

    // Fetch thumbnail and image info
    message.body.embeds = await Promise.all(
        message.body.embeds.map(async (embed) => {
            [embed.thumbnail, embed.image] = await Promise.all([
                embed.thumbnail?.url ? fetchImageInfo(embed.thumbnail.url) : undefined,
                embed.image?.url ? fetchImageInfo(embed.image.url) : undefined,
            ]);
            return embed;
        })
    );

    logInfo(`Post message created for ${news.title}.`);

    return message;
}

// Split message into smaller chunks to follow Discord embeds and character limits
function* splitMessageChunks(message: PostMessage): Iterable<PostMessage> {
    const maxEmbeds = 10;
    const maxChars = 3000;
    const embeds = message.body.embeds;

    for (let start = 0; start < embeds.length; ) {
        let totalChars = 0;
        let end = start;

        while (end < embeds.length && end - start < maxEmbeds) {
            const embed = embeds[end];
            const chars = (embed.title?.length || 0) + (embed.description?.length || 0);
            if (totalChars + chars > maxChars) break;
            totalChars += chars;
            end++;
        }

        yield {
            body: {
                embeds: embeds.slice(start, end),
            },
            category: message.category,
        };

        start = end;
    }
}

async function sendPendingMessages(): Promise<void> {
    const postMessages = listPostMessages();
    if (!Object.keys(postMessages).length) return;

    let stopSending = false;
    let pendingMessages: PendingMessage[];

    while (!stopSending && (pendingMessages = retrievePendingMessages()).length) {
        logInfo(`Sending ${pendingMessages.length} pending messages with message id ${pendingMessages[0].messageId}...`);

        const results = await Promise.allSettled(
            pendingMessages.map((message) => postChannelMessage(message.channelId, postMessages[message.messageId]!))
        );

        for (let i = 0; i < pendingMessages.length; i++) {
            const { id, channelId } = pendingMessages[i];
            const result = results[i];

            if (result.status === 'fulfilled') {
                deletePendingMessage(id);
            } else {
                // 50001: Missing Access, 50013: Missing Permissions, 10003: Unknown Channel
                if (result.reason instanceof DiscordAPIError && ['50001', '50013', '10003'].includes(result.reason.code.toString())) {
                    channelUnsubscribe(channelId);
                    logInfo(`Channel ${channelId} unsubscribed due to Discord error code ${result.reason.code}.`);
                } else {
                    // Unknown error, retry on next schedule
                    resetPendingMessage(id);
                    logError(`Failed to send message ${id} to channel ${channelId}.`, result.reason);
                    stopSending = true;
                }
            }
        }

        logInfo(`Pending messages with message id ${pendingMessages[0].messageId} sent.`);
    }

    deletePostMessages();
}

// Fetch latest news and send to Discord
export default async function handleSchedule(): Promise<void> {
    const news = await fetchNews();
    const { deletions, updates } = checkNewsDifference(news);

    if (updates.length) {
        const messages = await Promise.all(updates.map(createPostMessage));
        const messageChunks = messages.flatMap((message) => [...splitMessageChunks(message)]);
        updateLatestNews(deletions, updates, messageChunks);
    }

    await sendPendingMessages();
}
