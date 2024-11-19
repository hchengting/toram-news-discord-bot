import type { RawFile } from '@discordjs/rest';
import type { RESTPostAPIChannelMessageJSONBody } from 'discord-api-types/v10';

import { Database } from '@db/sqlite';
import { Buffer } from 'node:buffer';
import SQL from '~/db/sql.ts';
import { deserialize, serialize } from '~/helpers/utils.ts';

const DB_PATH = Deno.env.get('DB_PATH');
if (!DB_PATH) throw new Error('Missing database path.');

const db = new Database(DB_PATH);
db.exec(SQL.initializeDatabase);

// List all latest news
export function listLatestNews(): News[] {
    return db.prepare(SQL.listLatestNews).all() as News[];
}

// Update latest news and insert pending news based on categories subscribed by each channel
export function updateLatestNews(deletions: News[], updates: News[], messages: PostMessage[]): void {
    db.transaction(() => {
        const deleteStmt = db.prepare(SQL.deleteLatestNews);
        deletions.forEach((n) => deleteStmt.run({ url: n.url }));

        const insertUpdateStmt = db.prepare(SQL.insertLatestNews);
        updates.forEach((n) => insertUpdateStmt.run(n));

        const insertMsgStmt = db.prepare(SQL.insertPostMessages);
        messages.forEach((m) =>
            insertMsgStmt.run({
                body: serialize<RESTPostAPIChannelMessageJSONBody>(m.body),
                files: serialize<RawFile[]>(m.files),
                category: m.category,
            })
        );

        db.exec(SQL.insertPendingNews);
    })();
}

// List all post messages as a dictionary
export function listPostMessages(): PostMessages {
    const postMessages: PostMessages = {};
    const serializedPostMessages = db.prepare(SQL.listPostMessages).all() as SerializedPostMessage[];

    serializedPostMessages.forEach((m) => {
        const body = deserialize<RESTPostAPIChannelMessageJSONBody>(m.body);
        const files = deserialize<RawFile[]>(m.files).map((f) => ({ ...f, data: Buffer.from(f.data as string, 'hex') } as RawFile));
        postMessages[m.id] = { body, files, category: m.category } as PostMessage;
    });

    return postMessages;
}

// If the oldest pending news has not been retrieved for more than 5 minutes, retrieve it and update its retrieval timestamp
export function retrievePendingNews(): PendingNews {
    return db.prepare(SQL.retrievePendingNews).get() as PendingNews;
}

// Delete post message that does not be referenced by any pending news
export function deletePostMessage(): void {
    db.exec(SQL.deletePostMessage);
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
export function listChannelSubscriptions(channelId: string): Category[] {
    return db
        .prepare(SQL.listChannelSubscriptions)
        .all({ channelId })
        .map((s) => s.category);
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
