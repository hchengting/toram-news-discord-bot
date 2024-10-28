import { CronJob } from 'cron'
import http from 'http'
import schedule from './handlers/schedule.js'
import interaction from './handlers/interaction.js'

const job = new CronJob('5 * * * * *', schedule, null, true)

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

process.on('SIGINT', () => process.exit())
process.on('SIGTERM', () => process.exit())

server.listen(3000)
