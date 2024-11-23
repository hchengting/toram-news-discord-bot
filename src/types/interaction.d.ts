import type {
    APIActionRowComponent,
    APIChatInputApplicationCommandInteraction,
    APIInteractionResponseChannelMessageWithSource,
    APIInteractionResponsePong,
    APIMessageComponentSelectMenuInteraction,
    APIPingInteraction,
    APIStringSelectComponent,
    InteractionResponseType,
} from 'discord-api-types/v10';

export type Interaction = APIPingInteraction | APIChatInputApplicationCommandInteraction | APIMessageComponentSelectMenuInteraction;

type ValidInteraction = {
    valid: true;
    interaction: Interaction;
};

type InvalidInteraction = {
    valid: false;
    reason: Response;
};

export type InteractionVerificationResult = ValidInteraction | InvalidInteraction;

export type InteractionResponse = APIInteractionResponsePong | APIInteractionResponseChannelMessageWithSource;

export type InteractionResponseOptions = {
    type?: InteractionResponseType.Pong | InteractionResponseType.ChannelMessageWithSource;
    content?: string;
    components?: APIActionRowComponent<APIStringSelectComponent>[];
};
