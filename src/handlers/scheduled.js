import * as cheerio from 'cheerio'
import { htmlToText } from 'html-to-text'
import { Routes } from 'discord-api-types/v10'
import { getCategory } from '../consts.js'
import discordAPI from '../discord/api.js'
import formatters from '../formatter.js'
import query from '../db/query.js'

const url = 'https://tw.toram.jp/information'
const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
}

async function fetchNews() {
    const news = []
    const response = await fetch(url, { headers })

    if (response.status !== 200) {
        throw new Error(`Failed to fetch ${url}, status code: ${response.status}`)
    }

    const $ = cheerio.load(await response.text(), { baseURI: url })
    const data = $('div.useBox > ul').extract({
        news: [
            {
                selector: 'li.news_border',
                value: (el, _) => {
                    const $el = $(el)

                    return {
                        date: $el.find('time').attr('datetime'),
                        category: getCategory($el.find('img').prop('src')),
                        title: $el.find('p.news_title').text(),
                        url: $el.find('a').prop('href'),
                        thumbnail: $el.find('img').prop('src'),
                    }
                },
            },
        ],
    })

    news.push(...data.news.reverse())

    return news
}

async function fetchNewsContent(news) {
    const embeds = []
    const response = await fetch(news.url, { headers })

    if (response.status !== 200) {
        throw new Error(`Failed to fetch ${news.url}, status code: ${response.status}`)
    }

    const $ = cheerio.load(await response.text(), { baseURI: news.url })
    const $container = $('div.useBox.newsBox')

    let $contents = $container.contents()
    let start = $contents.index($container.find('div.smallTitleLine'))
    let end = $contents.index($container.find('h2.deluxetitle:contains("注意事項")'))
    if (end === -1) end = $contents.length

    // Remove unwant elements
    $contents.each((i, el) => {
        const $el = $(el)

        if (i <= start || i >= end) {
            $el.remove()
        } else if ($el.is('a') && $el.text() === '注意事項' && $contents.eq(i - 1).text() === '\n・') {
            $contents.eq(i - 1).remove()
            $el.remove()
        }
    })

    $container.find('a:contains("回頁面頂端")').remove()
    $container.find('h2.deluxetitle:contains("指定怪物")').nextAll('br').remove()

    // Resolve relative href
    $container.find('a').each((_, el) => $(el).attr('href', $(el).prop('href')))

    // Update contents
    $contents = $container.contents()

    // Split into sections by deluxe titles
    const $deluxeTitles = $container.find('h2.deluxetitle[id]')
    const sectionIndexs = [0, ...$deluxeTitles.map((_, el) => $contents.index(el)).toArray(), $contents.length]

    for (let i = 0; i < sectionIndexs.length - 1; i++) {
        const $section = $contents.slice(sectionIndexs[i] + 1, sectionIndexs[i + 1])
        const title = i === 0 ? news.title : $deluxeTitles.eq(i - 1).text()
        const url = i === 0 ? news.url : `${news.url}#${$deluxeTitles.eq(i - 1).attr('id')}`
        const thumbnail = i === 0 ? { url: news.thumbnail } : undefined

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
        }).replace(/\n{3,}/g, '\n\n')

        // Extract images from this section
        const images = $section
            .find('img')
            .map((_, el) => ({ url: $(el).prop('src') }))
            .toArray()

        embeds.push({
            title: title.slice(0, 128),
            url,
            thumbnail,
            description: description.slice(0, 2048),
            image: images.shift(),
            category: news.category,
        })

        embeds.push(...images.map((image) => ({ url, image, category: news.category })))
    }

    return embeds
}

function checkNewsDifference(news) {
    const latestNews = query.listLatestNews()
    const latestNewsSet = new Set(latestNews.map((n) => JSON.stringify(n)))
    const newsSet = new Set(news.map((n) => JSON.stringify(n)))

    return {
        deletions: [...latestNewsSet.difference(newsSet)].map((n) => JSON.parse(n)),
        updates: [...newsSet.difference(latestNewsSet)].map((n) => JSON.parse(n)),
    }
}

async function generateNewsEmbeds(updates) {
    const newsEmbeds = await Promise.all(updates.map(fetchNewsContent))

    function* chunks(embeds) {
        const maxEmbeds = 10
        const maxChars = 3000

        for (let i = 0; i < embeds.length; ) {
            let totalChars = 0
            let j = i

            while (j < embeds.length && j - i < maxEmbeds) {
                const embed = embeds[j]
                const chars = (embed.title?.length || 0) + (embed.description?.length || 0)

                if (totalChars + chars > maxChars) break

                totalChars += chars
                j++
            }

            yield embeds.slice(i, j)
            i = j
        }
    }

    // Split into smaller chunks to follow Discord embeds limit
    return newsEmbeds.flatMap((embeds) => [...chunks(embeds)])
}

async function sendPendingNews() {
    while (true) {
        const news = query.retrievePendingNews()
        if (!news) break

        try {
            await discordAPI.post(Routes.channelMessages(news.channelId), {
                headers: { 'content-type': 'application/json' },
                passThroughBody: true,
                body: news.body,
            })
            query.deletePendingNews(news.id)
        } catch (error) {
            query.resetPendingNews(news.id)

            // 50001: Missing Access, 50013: Missing Permissions, 10003: Unknown Channel
            if ([50001, 50013, 10003].includes(error.code)) {
                query.channelUnsubscribe(news.channelId)
            } else {
                throw error
            }
        }
    }
}

// Fetch latest news and send to Discord
export default async function scheduled() {
    const news = await fetchNews()
    const { deletions, updates } = checkNewsDifference(news)

    if (updates.length) {
        const newsEmbeds = await generateNewsEmbeds(updates)
        query.updateLatestNews(deletions, updates, newsEmbeds)
    }

    await sendPendingNews()
}
