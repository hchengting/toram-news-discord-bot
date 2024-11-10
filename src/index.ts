import { Cron } from 'croner';
import handleInteraction from './handlers/interaction';
import handleSchedule from './handlers/schedule';

process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit());

const cron = new Cron('5 * * * * *', async (): Promise<void> => {
    try {
        await handleSchedule();
    } catch (error) {
        console.error(new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }), error);
    }
});

Bun.serve({
    async fetch(request: Request): Promise<Response> {
        return await handleInteraction(request);
    },
    port: 3000,
});
