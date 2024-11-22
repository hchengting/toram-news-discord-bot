// SQL queries
const SQL = {
    initializeDatabase: `
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS channel_subscriptions (
            channel_id TEXT NOT NULL,
            category TEXT NOT NULL,
            PRIMARY KEY (channel_id, category)
        );

        CREATE TABLE IF NOT EXISTS latest_news (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            thumbnail TEXT NOT NULL,
            UNIQUE (date, category, title, url, thumbnail)
        );

        CREATE TABLE IF NOT EXISTS update_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            body TEXT NOT NULL,
            category TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS post_messages (
            id INTEGER PRIMARY KEY,
            body TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pending_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            retrieved_at NOT NULL DEFAULT 0,
            FOREIGN KEY (message_id) REFERENCES post_messages(id)
        );
    `,
    listLatestNews: `
        SELECT date, category, title, url, thumbnail
        FROM latest_news
        ORDER BY id ASC;
    `,
    insertLatestNews: `
        INSERT INTO latest_news (date, category, title, url, thumbnail)
        VALUES (:date, :category, :title, :url, :thumbnail);
    `,
    deleteLatestNews: `
        DELETE FROM latest_news
        WHERE url = :url;
    `,
    insertUpdateMessages: `
        INSERT INTO update_messages (body, category)
        VALUES (:body, :category);
    `,
    deleteUpdateMessages: `
        DELETE FROM update_messages;
    `,
    listPostMessages: `
        SELECT *
        FROM post_messages;
    `,
    insertPostMessages: `
        INSERT INTO post_messages (id, body)
        SELECT id, body
        FROM update_messages;
    `,
    deletePostMessages: `
        DELETE FROM post_messages
        WHERE NOT EXISTS (
            SELECT 1
            FROM pending_messages
            WHERE message_id = post_messages.id
        );
    `,
    insertPendingMessages: `
        INSERT INTO pending_messages (channel_id, message_id)
        SELECT channel_subscriptions.channel_id, update_messages.id
        FROM channel_subscriptions
        INNER JOIN update_messages
        ON channel_subscriptions.category = update_messages.category
        ORDER BY update_messages.id ASC;
    `,
    retrievePendingMessage: `
        UPDATE pending_messages
        SET retrieved_at = unixepoch()
        WHERE id = (
            SELECT MIN(id)
            FROM pending_messages
        )
        AND unixepoch() - retrieved_at > 300
        RETURNING id, channel_id AS channelId, message_id AS messageId;
    `,
    resetPendingMessage: `
        UPDATE pending_messages
        SET retrieved_at = 0
        WHERE id = :id;
    `,
    deletePendingMessage: `
        DELETE FROM pending_messages
        WHERE id = :id;
    `,
    deletePendingMessagesByChannelId: `
        DELETE FROM pending_messages
        WHERE channel_id = :channelId;
    `,
    listChannelSubscriptions: `
        SELECT category
        FROM channel_subscriptions
        WHERE channel_id = :channelId;
    `,
    insertChannelSubscriptions: `
        INSERT INTO channel_subscriptions (channel_id, category)
        VALUES (:channelId, :category);
    `,
    deleteChannelSubscriptions: `
        DELETE FROM channel_subscriptions
        WHERE channel_id = :channelId;
    `,
};

export default SQL;
