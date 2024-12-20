import { Cron } from '@hexagon/croner';
import { closeDatabase } from '~/db/queries.ts';
import handleInteraction from '~/handlers/interaction.ts';
import handleSchedule from '~/handlers/schedule.ts';
import { logError } from '~/helpers/utils.ts';

globalThis.addEventListener('unload', closeDatabase);

Deno.addSignalListener('SIGINT', Deno.exit);
if (Deno.build.os !== 'windows') Deno.addSignalListener('SIGTERM', Deno.exit);

const _cron = new Cron('3 * * * * *', async () => {
    try {
        await handleSchedule();
    } catch (error) {
        logError(error);
    }
});

Deno.serve({ port: 3000 }, async (request) => {
    try {
        return await handleInteraction(request);
    } catch (error) {
        logError(error);
        return new Response('Internal Server Error', { status: 500 });
    }
});
