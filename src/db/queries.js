import { DatabaseSync } from 'node:sqlite'
import SQL from './sql.js'

const db = new DatabaseSync(process.env.DB_PATH)

const transaction = (callback) => {
    db.exec(`BEGIN;`)
    try {
        callback()
        db.exec(`COMMIT;`)
    } catch (error) {
        db.exec(`ROLLBACK;`)
        throw error
    }
}

// List all latest news
const listLatestNews = () => db.prepare(SQL.listLatestNews).all()

// Update latest news and insert pending news based on categories subscribed by each channel
const updateLatestNews = (deletions, updates, newsEmbeds) => {
    transaction(() => {
        const deleteStmt = db.prepare(SQL.deleteLatestNews)
        deletions.forEach((n) => deleteStmt.run(n.url))

        const insertUpdateStmt = db.prepare(SQL.insertLatestNews)
        updates.forEach((n) => insertUpdateStmt.run(n.date, n.category, n.title, n.url, n.thumbnail))

        db.exec(SQL.createTempNewsEmbeds)

        const insertEmbedStmt = db.prepare(SQL.insertNewsEmbeds)
        newsEmbeds.forEach((embeds) => insertEmbedStmt.run(JSON.stringify({ embeds }), embeds[0].category))

        db.exec(SQL.insertPendingNews)
        db.exec(SQL.dropTempNewsEmbeds)
    })
}

// If the oldest pending news has not been retrieved for more than 5 minutes, retrieve it and update its retrieval timestamp
const retrievePendingNews = () => db.prepare(SQL.retrievePendingNews).get()

// Delete pending news
const deletePendingNews = (id) => db.prepare(SQL.deletePendingNewsById).run(id)

// Reset pending news retrieval timestamp
const resetPendingNews = (id) => db.prepare(SQL.resetPendingNews).run(id)

// List subscribed categories of a channel
const listChannelSubscriptions = (channelId) => db.prepare(SQL.listChannelSubscriptions).all(channelId)

// Check if a channel is subscribed to any category
const isChannelSubscribed = (channelId) => !!db.prepare(SQL.listChannelSubscriptions).get(channelId)

// Delete channel from pending news and channel subscriptions
const channelUnsubscribe = (channelId) => {
    transaction(() => {
        db.prepare(SQL.deletePendingNewsByChannelId).run(channelId)
        db.prepare(SQL.deleteChannelSubscriptions).run(channelId)
    })
}

// Delete channel from pending news and channel subscriptions, and insert channel subscriptions with new categories
const channelSubscribe = (channelId, categories) => {
    transaction(() => {
        db.prepare(SQL.deletePendingNewsByChannelId).run(channelId)
        db.prepare(SQL.deleteChannelSubscriptions).run(channelId)

        const stmt = db.prepare(SQL.insertChannelSubscriptions)
        categories.forEach((category) => stmt.run(channelId, category))
    })
}

db.exec(SQL.initializeDatabase)

export {
    listLatestNews,
    updateLatestNews,
    retrievePendingNews,
    deletePendingNews,
    resetPendingNews,
    listChannelSubscriptions,
    isChannelSubscribed,
    channelUnsubscribe,
    channelSubscribe,
}
