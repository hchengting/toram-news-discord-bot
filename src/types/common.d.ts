type Category = '商城' | '活動' | '更新' | '維修' | '重要' | 'BUG';

type ImageSize = {
    width: number;
    height: number;
};

type News = {
    date: string;
    category?: Category;
    title: string;
    url: string;
    thumbnail: string;
};

type NewsDifference = {
    deletions: News[];
    updates: News[];
};

type PendingNews =
    | {
          id: number;
          channelId: string;
          messageId: number;
      }
    | undefined;

type PostMessage = {
    body: {
        embeds: import('discord-api-types/v10').APIEmbed[];
        attachments: import('discord-api-types/v10').RESTAPIAttachment[];
    };
    files: import('@discordjs/rest').RawFile[];
    category?: Category;
};

type PostMessages = Record<number, PostMessage>;

type SerializedPostMessage = {
    id: number;
    body: string;
    files: string;
    category: Category;
};
