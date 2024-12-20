import type { Snowflake } from 'discord-api-types/v10';

import { Database } from '@db/sqlite';
import SQL from '~/db/sql.ts';
import { sortCategories } from '~/helpers/categories.ts';
import { serialize } from '~/helpers/utils.ts';

const DB_PATH = Deno.env.get('DB_PATH');
if (!DB_PATH) throw new Error('Missing database path.');

const db = new Database(DB_PATH);
db.exec(SQL.initializeDatabase);

// List all latest news
export function listLatestNews(): News[] {
    return db.prepare(SQL.listLatestNews).all() as News[];
}

// Update latest news and insert pending messages based on categories subscribed by each channel
export function updateLatestNews(deletions: News[], updates: News[], messages: PostMessage[]): void {
    db.transaction(() => {
        const deleteStmt = db.prepare(SQL.deleteLatestNews);
        deletions.forEach((n) => deleteStmt.run({ url: n.url }));

        const insertUpdateStmt = db.prepare(SQL.insertLatestNews);
        updates.forEach((n) => insertUpdateStmt.run(n));

        const insertMsgStmt = db.prepare(SQL.insertUpdateMessages);
        messages.forEach((m) =>
            insertMsgStmt.run({
                body: serialize<PostMessageBody>(m.body),
                category: m.category,
            })
        );

        db.exec(SQL.insertPendingMessages);
    })();
}

// List all post messages using their ids as keys
export function listPostMessages(): SerializedPostMessages {
    const postMessages: SerializedPostMessages = {};
    const serializedPostMessages = db.prepare(SQL.listPostMessages).all() as SerializedPostMessage[];

    serializedPostMessages.forEach((m) => (postMessages[m.id] = m.body));

    return postMessages;
}

// Retrieve all pending messages that have the same minimum message id and have not been retrieved for more than 5 minutes
export function retrievePendingMessages(): PendingMessage[] {
    return db.prepare(SQL.retrievePendingMessages).all() as PendingMessage[];
}

// Delete pending message
export function deletePendingMessage(id: number): void {
    db.prepare(SQL.deletePendingMessage).run({ id });
}

// Reset pending message retrieval timestamp
export function resetPendingMessage(id: number): void {
    db.prepare(SQL.resetPendingMessage).run({ id });
}

// Delete post messages that do not be referenced by any pending messages
export function deletePostMessages(): void {
    db.exec(SQL.deletePostMessages);
}

// List subscribed categories of a channel
export function listChannelSubscriptions(channelId: Snowflake): Category[] {
    const subscriptions = db.prepare(SQL.listChannelSubscriptions).all({ channelId });
    const categories = sortCategories(subscriptions.map((s) => s.category));

    return categories;
}

// Check if a channel is subscribed to any category
export function isChannelSubscribed(channelId: Snowflake): boolean {
    return !!db.prepare(SQL.listChannelSubscriptions).get({ channelId });
}

// Delete channel from pending messages and channel subscriptions
function channelCleanup(channelId: Snowflake): void {
    db.prepare(SQL.deletePendingMessagesByChannelId).run({ channelId });
    db.prepare(SQL.deleteChannelSubscriptions).run({ channelId });
}

// Unsubscribe channel from all categories
export function channelUnsubscribe(channelId: Snowflake): void {
    db.transaction(() => {
        channelCleanup(channelId);
    })();
}

// Unsubscribe channel from all categories and subscribe to new categories
export function channelSubscribe(channelId: Snowflake, categories: Category[]): void {
    db.transaction(() => {
        channelCleanup(channelId);

        const stmt = db.prepare(SQL.insertChannelSubscriptions);
        categories = sortCategories(categories);
        categories.forEach((category) => stmt.run({ channelId, category }));
    })();
}

// Close database connection
export function closeDatabase(): void {
    db.close();
}
