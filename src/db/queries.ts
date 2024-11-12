import type { RESTPostAPIChannelMessageJSONBody } from 'discord-api-types/v10';

import { Database } from '@db/sqlite';
import SQL from '~/db/sql.ts';
import { serialize } from '~/helpers/utils.ts';

const DB_PATH = Deno.env.get('DB_PATH');
if (!DB_PATH) throw new Error('Missing database path.');

const db = new Database(DB_PATH);
db.exec(SQL.initializeDatabase);

// List all latest news
export function listLatestNews(): News[] {
    return db.prepare(SQL.listLatestNews).all() as News[];
}

// Update latest news and insert pending news based on categories subscribed by each channel
export function updateLatestNews(deletions: News[], updates: News[], newsEmbeds: Embed[][]): void {
    db.transaction(() => {
        const deleteStmt = db.prepare(SQL.deleteLatestNews);
        deletions.forEach((n) => deleteStmt.run({ url: n.url }));

        const insertUpdateStmt = db.prepare(SQL.insertLatestNews);
        updates.forEach((n) => insertUpdateStmt.run(n));

        db.exec(SQL.createTempNewsEmbeds);

        const insertEmbedStmt = db.prepare(SQL.insertNewsEmbeds);
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
    return db.prepare(SQL.retrievePendingNews).get() as PendingNews;
}

// Delete pending news
export function deletePendingNews(id: number): void {
    db.prepare(SQL.deletePendingNewsById).run({ id });
}

// Reset pending news retrieval timestamp
export function resetPendingNews(id: number): void {
    db.prepare(SQL.resetPendingNews).run({ id });
}

// List subscribed categories of a channel
export function listChannelSubscriptions(channelId: string): { category: string }[] {
    return db.prepare(SQL.listChannelSubscriptions).all({ channelId }) as { category: string }[];
}

// Check if a channel is subscribed to any category
export function isChannelSubscribed(channelId: string): boolean {
    return !!db.prepare(SQL.listChannelSubscriptions).get({ channelId });
}

// Delete channel from pending news and channel subscriptions
export function channelUnsubscribe(channelId: string): void {
    db.transaction(() => {
        db.prepare(SQL.deletePendingNewsByChannelId).run({ channelId });
        db.prepare(SQL.deleteChannelSubscriptions).run({ channelId });
    })();
}

// Delete channel from pending news and channel subscriptions, and insert channel subscriptions with new categories
export function channelSubscribe(channelId: string, categories: Category[]): void {
    db.transaction(() => {
        db.prepare(SQL.deletePendingNewsByChannelId).run({ channelId });
        db.prepare(SQL.deleteChannelSubscriptions).run({ channelId });

        const stmt = db.prepare(SQL.insertChannelSubscriptions);
        categories.forEach((category) => stmt.run({ channelId, category }));
    })();
}

// Close the database connection
export function closeDatabase(): void {
    db.close();
}
