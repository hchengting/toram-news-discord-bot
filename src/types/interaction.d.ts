import type {
    APIActionRowComponent,
    APIChatInputApplicationCommandInteraction,
    APIMessageComponentSelectMenuInteraction,
    APIPingInteraction,
    APIStringSelectComponent,
    InteractionResponseType,
} from 'discord-api-types/v10';

type Interaction = APIPingInteraction | APIChatInputApplicationCommandInteraction | APIMessageComponentSelectMenuInteraction;

type ValidInteraction = { valid: true; interaction: Interaction };

type InvalidInteraction = { valid: false; clientError: Response };

export type VerifyInteractionResult = ValidInteraction | InvalidInteraction;

export type InteractionResponseParams = {
    type?: InteractionResponseType.Pong | InteractionResponseType.ChannelMessageWithSource;
    content?: string;
    components?: APIActionRowComponent<APIStringSelectComponent>[];
};
