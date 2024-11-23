type Category = '商城' | '活動' | '更新' | '維修' | '重要' | 'BUG' | '';

type News = {
    date: string;
    category: Category;
    title: string;
    url: string;
    thumbnail: string;
};

type NewsDifference = {
    deletions: News[];
    updates: News[];
};

type ImageSize = {
    width?: number;
    height?: number;
};

type PostMessageBody = Required<Pick<import('discord-api-types/v10').RESTPostAPIChannelMessageJSONBody, 'embeds'>>;

type PostMessage = {
    body: PostMessageBody;
    category: Category;
};

type PostMessages = Record<number, Omit<PostMessage, 'category'>>;

type SerializedPostMessage = {
    id: number;
    body: string;
};

type PendingMessage =
    | {
          id: number;
          channelId: import('discord-api-types/v10').Snowflake;
          messageId: number;
      }
    | undefined;