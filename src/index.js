import { CronJob } from 'cron'
import http from 'http'
import scheduled from './handlers/scheduled.js'
import interaction from './handlers/interaction.js'

process.on('SIGINT', () => process.exit())
process.on('SIGTERM', () => process.exit())

const cron = CronJob.from({
    cronTime: '5 * * * * *',
    onTick: async () => {
        try {
            await scheduled()
        } catch (error) {
            console.error(new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }), error)
        }
    },
})

const server = http.createServer(async (request, response) => {
    try {
        const { status = 200, headers = {}, body = '' } = await interaction(request)
        response.writeHead(status, headers)
        response.end(body)
    } catch (error) {
        console.error(new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }), error)
        response.writeHead(500)
        response.end()
    }
})

cron.start()
server.listen(3000)