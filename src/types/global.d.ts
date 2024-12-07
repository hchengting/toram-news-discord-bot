type Category = import('~/helpers/categories.ts').Category;

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

type ImageInfo = {
    url: string;
    width?: number;
    height?: number;
};

type PostMessageBody = Required<Pick<import('discord-api-types/v10').RESTPostAPIChannelMessageJSONBody, 'embeds'>>;

type PostMessage = {
    body: PostMessageBody;
    category: Category;
};

type SerializedPostMessageBody = string;

type SerializedPostMessage = {
    id: number;
    body: SerializedPostMessageBody;
};

type SerializedPostMessages = Partial<Record<number, SerializedPostMessageBody>>;

type PendingMessage = {
    id: number;
    channelId: import('discord-api-types/v10').Snowflake;
    messageId: number;
};
