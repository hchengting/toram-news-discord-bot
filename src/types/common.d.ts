type Category = '商城' | '活動' | '更新' | '維修' | '重要' | 'BUG';

type News = {
    date: string;
    category: string;
    title: string;
    url: string;
    thumbnail: string;
};

type PendingNews = {
    id: number;
    channelId: string;
    body: string;
};

type Embed = import('discord-api-types/v10').APIEmbed & { category: string };
