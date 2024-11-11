import { registerCommands } from '~/discord/api.ts';

const commands = {
    LIST: {
        name: 'list',
        description: '列出此頻道所有訂閱',
    },
    SUBSCRIBE: {
        name: 'subscribe',
        description: '訂閱公告至此頻道',
    },
    UNSUBSCRIBE: {
        name: 'unsubscribe',
        description: '取消此頻道所有訂閱',
    },
};

await registerCommands(Object.values(commands));

export default commands;
