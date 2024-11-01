// SQL queries
const SQL = {
    initializeDatabase: `
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
    `,
    listLatestNews: `
        SELECT date, category, title, url, thumbnail
        FROM latest_news
        ORDER BY id ASC;
    `,
    deleteLatestNews: `
        DELETE FROM latest_news
        WHERE url = ?;
    `,
    insertLatestNews: `
        INSERT INTO latest_news (date, category, title, url, thumbnail)
        VALUES (?, ?, ?, ?, ?);
    `,
    createTempNewsEmbeds: `
        CREATE TABLE temp.news_embeds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            body TEXT,
            category TEXT
        );
    `,
    insertNewsEmbeds: `
        INSERT INTO temp.news_embeds (body, category)
        VALUES (?, ?);
    `,
    insertPendingNews: `
        INSERT INTO pending_news (channel_id, body)
        SELECT channel_subscriptions.channel_id, temp.news_embeds.body
        FROM temp.news_embeds
        JOIN channel_subscriptions
        ON temp.news_embeds.category = channel_subscriptions.category
        ORDER BY temp.news_embeds.id ASC;
    `,
    dropTempNewsEmbeds: `
        DROP TABLE temp.news_embeds;
    `,
    retrievePendingNews: `
        UPDATE pending_news
        SET retrieved_at = unixepoch()
        WHERE id = (
            SELECT MIN(id)
            FROM pending_news
        )
        AND unixepoch() - retrieved_at > 300
        RETURNING id, channel_id AS channelId, body;
    `,
    deletePendingNewsById: `
        DELETE FROM pending_news
        WHERE id = ?;
    `,
    deletePendingNewsByChannelId: `
        DELETE FROM pending_news
        WHERE channel_id = ?;
    `,
    resetPendingNews: `
        UPDATE pending_news
        SET retrieved_at = 0
        WHERE id = ?;
    `,
    listChannelSubscriptions: `
        SELECT *
        FROM channel_subscriptions
        WHERE channel_id = ?;
    `,
    deleteChannelSubscriptions: `
        DELETE FROM channel_subscriptions
        WHERE channel_id = ?;
    `,
    insertChannelSubscriptions: `
        INSERT INTO channel_subscriptions (channel_id, category)
        VALUES (?, ?);
    `,
}

export default SQL
