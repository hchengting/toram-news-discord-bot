import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync(process.env.DB_PATH)

const query = {
    // Update latest news and insert pending news
    updateLatestNews: (deletions, updates, newsEmbeds) => {
        db.exec(`BEGIN;`)
        // Delete old news
        const deleteLatestNews = db.prepare(`
            DELETE FROM latest_news
            WHERE url = ?;
        `)
        deletions.forEach((n) => deleteLatestNews.run(n.url))
        // Insert updates
        const insertLatestNews = db.prepare(`
            INSERT INTO latest_news (date, category, title, url, thumbnail)
            VALUES (?, ?, ?, ?, ?);
        `)
        updates.forEach((n) => insertLatestNews.run(n.date, n.category, n.title, n.url, n.thumbnail))
        // Insert news embeds into a temporary table
        db.exec(`
            CREATE TABLE temp.news_embeds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                body TEXT,
                category TEXT
            );
        `)
        const insertNewsEmbeds = db.prepare(`
            INSERT INTO temp.news_embeds (body, category)
            VALUES (?, ?);
        `)
        newsEmbeds.forEach((embeds) => insertNewsEmbeds.run(JSON.stringify({ embeds }), embeds[0].category))
        // Insert pending news based on the news category subsribed by each channel
        db.exec(`
            INSERT INTO pending_news (channel_id, body)
            SELECT channel_subscriptions.channel_id, temp.news_embeds.body
            FROM temp.news_embeds
            JOIN channel_subscriptions
            ON temp.news_embeds.category = channel_subscriptions.category
            ORDER BY temp.news_embeds.id ASC;

            DROP TABLE temp.news_embeds;
            
            COMMIT;
        `)
    },
    // List all latest news
    listLatestNews: () => {
        const stmt = db.prepare(`
            SELECT date, category, title, url, thumbnail
            FROM latest_news
            ORDER BY id ASC;
        `)
        return stmt.all()
    },
    // If the oldest pending news has not been retrieved for more than 5 minutes, retrieve it and update its retrieval timestamp
    retrievePendingNews: () => {
        const stmt = db.prepare(`
            UPDATE pending_news
            SET retrieved_at = unixepoch()
            WHERE id = (
                SELECT MIN(id)
                FROM pending_news
            )
            AND unixepoch() - retrieved_at > 300
            RETURNING id, channel_id AS channelId, body;
        `)
        return stmt.get()
    },
    // Delete pending news by id
    deletePendingNews: (id) => {
        const stmt = db.prepare(`
            DELETE FROM pending_news
            WHERE id = ?;
        `)
        stmt.run(id)
    },
    // Reset pending news retrieval timestamp by id
    resetPendingNews: (id) => {
        const stmt = db.prepare(`
            UPDATE pending_news
            SET retrieved_at = 0
            WHERE id = ?;
        `)
        stmt.run(id)
    },
    // Check if a channel is subscribed to any category
    isChannelSubscribed: (id) => {
        const stmt = db.prepare(`
            SELECT *
            FROM channel_subscriptions
            WHERE channel_id = ?;
        `)
        return !!stmt.get(id)
    },
    // Insert channel subscriptions with categories
    channelSubscribe: (id, categories) => {
        db.exec(`BEGIN;`)
        // Delete old pending news
        const deletePendingNews = db.prepare(`
            DELETE FROM pending_news
            WHERE channel_id = ?;
        `)
        deletePendingNews.run(id)
        // Delete old subscriptions
        const deleteChannelSubscriptions = db.prepare(`
            DELETE FROM channel_subscriptions
            WHERE channel_id = ?;
        `)
        deleteChannelSubscriptions.run(id)
        // Insert new subscriptions
        const insertChannelSubscriptions = db.prepare(`
            INSERT INTO channel_subscriptions (channel_id, category)
            VALUES (?, ?);
        `)
        categories.forEach((category) => insertChannelSubscriptions.run(id, category))
        db.exec(`COMMIT;`)
    },
    // Delete channel from pending news and channel subscriptions
    channelUnsubscribe: (id) => {
        db.exec(`BEGIN;`)
        // Delete old pending news
        const deletePendingNews = db.prepare(`
            DELETE FROM pending_news
            WHERE channel_id = ?;
        `)
        deletePendingNews.run(id)
        // Delete old subscriptions
        const deleteChannelSubscriptions = db.prepare(`
            DELETE FROM channel_subscriptions
            WHERE channel_id = ?;
        `)
        deleteChannelSubscriptions.run(id)
        db.exec(`COMMIT;`)
    },
}

db.exec(`
    CREATE TABLE IF NOT EXISTS latest_news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        thumbnail TEXT NOT NULL,
        UNIQUE (date, category, title, url, thumbnail)
    );

    CREATE TABLE IF NOT EXISTS pending_news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        body TEXT NOT NULL,
        retrieved_at NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS channel_subscriptions (
        channel_id TEXT NOT NULL,
        category TEXT NOT NULL,
        PRIMARY KEY (channel_id, category)
    );
`)

export default query
