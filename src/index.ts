import { Cron } from '@hexagon/croner';
import handleInteraction from './handlers/interaction.ts';
import handleSchedule from './handlers/schedule.ts';

Deno.addSignalListener('SIGINT', () => Deno.exit());
if (Deno.build.os !== 'windows') Deno.addSignalListener('SIGTERM', () => Deno.exit());

const _cron = new Cron('5 * * * * *', async (): Promise<void> => {
    try {
        await handleSchedule();
    } catch (error) {
        console.error(new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }), error);
    }
});

Deno.serve({ port: 3000 }, async (request: Request): Promise<Response> => {
    try {
        return await handleInteraction(request);
    } catch (error) {
        console.error(new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }), error);
        return new Response('Internal Server Error', { status: 500 });
    }
});
