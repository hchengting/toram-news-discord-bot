import type { RESTPostAPIChannelMessageJSONBody } from 'discord-api-types/v10';
import { Database } from 'bun:sqlite';
import { serialize } from '../helpers/utils';
import SQL from './sql';

const db = new Database(process.env.DB_PATH, { strict: true });
db.exec(SQL.initializeDatabase);

// List all latest news
export function listLatestNews(): News[] {
    return db.query(SQL.listLatestNews).all() as News[];
}

// Update latest news and insert pending news based on categories subscribed by each channel
export function updateLatestNews(deletions: News[], updates: News[], newsEmbeds: Embed[][]): void {
    db.transaction(() => {
        const deleteStmt = db.query(SQL.deleteLatestNews);
        deletions.forEach((n) => deleteStmt.run({ url: n.url }));

        const insertUpdateStmt = db.query(SQL.insertLatestNews);
        updates.forEach((n) => insertUpdateStmt.run(n));

        db.exec(SQL.createTempNewsEmbeds);

        const insertEmbedStmt = db.query(SQL.insertNewsEmbeds);
        newsEmbeds.forEach((embeds) =>
            insertEmbedStmt.run({
                body: serialize<RESTPostAPIChannelMessageJSONBody>({ embeds }),
                category: embeds[0].category,
            })
        );

        db.exec(SQL.insertPendingNews);
        db.exec(SQL.dropTempNewsEmbeds);
    })();
}

// If the oldest pending news has not been retrieved for more than 5 minutes, retrieve it and update its retrieval timestamp
export function retrievePendingNews(): PendingNews {
    return db.query(SQL.retrievePendingNews).get() as PendingNews;
}

// Delete pending news
export function deletePendingNews(id: number): void {
    db.query(SQL.deletePendingNewsById).run({ id });
}

// Reset pending news retrieval timestamp
export function resetPendingNews(id: number): void {
    db.query(SQL.resetPendingNews).run({ id });
}

// List subscribed categories of a channel
export function listChannelSubscriptions(channelId: string): { category: string }[] {
    return db.query(SQL.listChannelSubscriptions).all({ channelId }) as { category: string }[];
}

// Check if a channel is subscribed to any category
export function isChannelSubscribed(channelId: string): boolean {
    return !!db.query(SQL.listChannelSubscriptions).get({ channelId });
}

// Delete channel from pending news and channel subscriptions
export function channelUnsubscribe(channelId: string): void {
    db.transaction(() => {
        db.query(SQL.deletePendingNewsByChannelId).run({ channelId });
        db.query(SQL.deleteChannelSubscriptions).run({ channelId });
    })();
}

// Delete channel from pending news and channel subscriptions, and insert channel subscriptions with new categories
export function channelSubscribe(channelId: string, categories: Category[]): void {
    db.transaction(() => {
        db.query(SQL.deletePendingNewsByChannelId).run({ channelId });
        db.query(SQL.deleteChannelSubscriptions).run({ channelId });

        const stmt = db.query(SQL.insertChannelSubscriptions);
        categories.forEach((category) => stmt.run({ channelId, category }));
    })();
}
