import type {
    APIActionRowComponent,
    APIChatInputApplicationCommandInteraction,
    APIMessageComponentSelectMenuInteraction,
    APIPingInteraction,
    APIStringSelectComponent,
} from 'discord-api-types/v10';

import { InteractionResponseType } from 'discord-api-types/v10';

type Interaction = APIPingInteraction | APIChatInputApplicationCommandInteraction | APIMessageComponentSelectMenuInteraction;

export type VerifyInteraction = { valid: false; clientError: Response } | { valid: true; interaction: Interaction };

export type InteractionResponseParams = Partial<{
    content: string;
    components: APIActionRowComponent<APIStringSelectComponent>[];
    type: InteractionResponseType.Pong | InteractionResponseType.ChannelMessageWithSource;
}>;
