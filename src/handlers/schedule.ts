import type { RawFile } from '@discordjs/rest';

import { DiscordAPIError } from '@discordjs/rest';
import * as cheerio from 'cheerio';
import { htmlToText } from 'html-to-text';
import sharp from 'sharp';
import {
    channelUnsubscribe,
    deletePendingNews,
    deletePostMessage,
    listLatestNews,
    listPostMessages,
    resetPendingNews,
    retrievePendingNews,
    updateLatestNews,
} from '~/db/queries.ts';
import { postChannelMessage } from '~/discord/api.ts';
import { getCategory } from '~/helpers/categories.ts';
import formatters from '~/helpers/formatters.ts';
import { deserialize, serialize } from '~/helpers/utils.ts';

const url = 'https://tw.toram.jp/information';
const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
};

async function fetchNews(): Promise<News[]> {
    const news: News[] = [];
    const response = await fetch(url, { headers });

    if (response.status !== 200) {
        throw new Error(`Failed to fetch ${url}, status code: ${response.status}`);
    }

    const $ = cheerio.load(await response.text(), { baseURI: url });
    const data = $('div.useBox > ul').extract({
        news: [
            {
                selector: 'li.news_border',
                value: (el, _key) => {
                    const $el = $(el);

                    return {
                        date: $el.find('time').attr('datetime') || '',
                        category: getCategory($el.find('img').prop('src')),
                        title: $el.find('p.news_title').text() || '',
                        url: $el.find('a').prop('href') || '',
                        thumbnail: $el.find('img').prop('src') || '',
                    };
                },
            },
        ],
    });

    news.push(...data.news.reverse());

    return news;
}

function checkNewsDifference(news: News[]): { deletions: News[]; updates: News[] } {
    const latestNews = listLatestNews();
    const latestNewsSet = new Set(latestNews.map((n) => serialize<News>(n)));
    const newsSet = new Set(news.map((n) => serialize<News>(n)));
    const deletions = [...latestNewsSet.difference(newsSet)].map((n) => deserialize<News>(n));
    const updates = [...newsSet.difference(latestNewsSet)].map((n) => deserialize<News>(n));

    return { deletions, updates };
}

export async function fetchImage(src: string | undefined): Promise<RawFile> {
    if (!src) return { data: '', name: '' };

    const response = await fetch(src);

    if (response.status !== 200) {
        throw new Error(`Failed to fetch ${src}, status code: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const image = sharp(arrayBuffer);
    const buffer = await image.resize(400).webp().toBuffer();
    const data = buffer.toString('hex');
    const name = `${new URL(src).pathname.split('/').pop()?.split('.')?.[0] || data.slice(0, 8)}.webp`;

    return { data, name };
}

async function createPostMessage(news: News): Promise<PostMessage> {
    const message: PostMessage = {
        body: {
            embeds: [],
            attachments: [],
        },
        files: [await fetchImage(news.thumbnail)],
        category: news.category,
    };

    // Fetch news content
    const response = await fetch(news.url, { headers });

    if (response.status !== 200) {
        throw new Error(`Failed to fetch ${news.url}, status code: ${response.status}`);
    }

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
        const thumbnail = i === 0 ? { url: `attachment://${message.files[0].name}` } : undefined;

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

        // Fetch images from this section
        const images = $section.find('img').toArray();
        const imageFiles = await Promise.all(images.map((el) => fetchImage($(el).prop('src'))));
        message.files.push(...imageFiles);

        message.body.embeds.push({
            title: title.slice(0, 128),
            url,
            thumbnail,
            description: description.slice(0, 2048),
            image: imageFiles.length ? { url: `attachment://${imageFiles.shift()!.name}` } : undefined,
        });

        message.body.embeds.push(...imageFiles.map((img) => ({ url, image: { url: `attachment://${img.name}` } })));
    }

    return message;
}

// Split message into smaller chunks to follow Discord embeds, files, and character limits
function* splitMessageChunks(message: PostMessage): Iterable<PostMessage> {
    const maxEmbeds = 10;
    const maxFiles = 10;
    const maxChars = 3000;
    const embeds = message.body.embeds;

    for (let start = 0, fileStart = 0; start < embeds.length; ) {
        let totalChars = 0;
        let end = start;
        let fileEnd = fileStart;

        while (end < embeds.length && end - start < maxEmbeds && fileEnd - fileStart < maxFiles) {
            const embed = embeds[end];
            const chars = (embed.title?.length || 0) + (embed.description?.length || 0);

            if (totalChars + chars > maxChars) break;

            totalChars += chars;
            end++;

            if (embed.thumbnail) fileEnd++;
            if (embed.image) fileEnd++;
        }

        const files = message.files.slice(fileStart, fileEnd);
        const attachments = files.map((_f, i) => ({ id: i }));

        yield {
            body: {
                embeds: embeds.slice(start, end),
                attachments,
            },
            files,
            category: message.category,
        };

        start = end;
        fileStart = fileEnd;
    }
}

async function sendPendingNews(): Promise<void> {
    const postMessages = listPostMessages();

    while (true) {
        const pendingNews = retrievePendingNews();
        if (!pendingNews) break;

        const { id, channelId, messageId } = pendingNews;
        const { body, files } = postMessages[messageId];

        try {
            await postChannelMessage(channelId, body, files);
            deletePendingNews(id);
        } catch (error) {
            resetPendingNews(id);

            // 50001: Missing Access, 50013: Missing Permissions, 10003: Unknown Channel
            if (['50001', '50013', '10003'].includes((error as DiscordAPIError).code.toString())) {
                channelUnsubscribe(channelId);
            } else {
                throw error;
            }
        }
    }

    deletePostMessage();
}

// Fetch latest news and send to Discord
export default async function handleSchedule(): Promise<void> {
    const news = await fetchNews();
    const { deletions, updates } = checkNewsDifference(news);

    if (updates.length) {
        const messageUpdates = await Promise.all(updates.map(createPostMessage));
        const messageChunks = messageUpdates.flatMap((message) => [...splitMessageChunks(message)]);

        updateLatestNews(deletions, updates, messageChunks);
    }

    await sendPendingNews();
}
