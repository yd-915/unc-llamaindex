import { Bot } from "@/app/store/bot";
import { nanoid } from "nanoid";
import Locale from "../locales";
import { ModelType } from "@/app/client/platforms/llm";
import { createEmptySession } from "../store";

const TEMPLATE = (PERSONA: string) =>
  `I want you to act as a ${PERSONA}. I will provide you with the context needed to solve my problem. Use intelligent, simple, and understandable language. Be concise. It is helpful to explain your thoughts step by step and with bullet points.`;

const DEMO_BOTS: Omit<Bot, "id" | "session">[] = [
  {
    avatar: "1f916",
    name: "My Documents",
    botHello: "Hello! How can I assist you today?",
    context: [],
    modelConfig: {
      model: "gpt-4",
      temperature: 0.3,
      maxTokens: 8000,
      sendMemory: true,
    },
    readOnly: false,
    hideContext: false,
  },
  {
    avatar: "1f5a5-fe0f",
    name: "Red Hat Linux Expert",
    botHello: "Hello! How can I help you with Red Hat Linux?",
    context: [
      {
        role: "system",
        content: TEMPLATE("Red Hat Linux Expert"),
      },
    ],
    modelConfig: {
      model: "gpt-3.5-turbo-16k",
      temperature: 0.1,
      maxTokens: 8000,
      sendMemory: true,
    },
    readOnly: false,
    datasource: "redhat",
    hideContext: false,
  },
  {
    avatar: "1f454",
    name: "Apple Watch Genius",
    botHello: "Hello! How can I help you with Apple Watches?",
    context: [
      {
        role: "system",
        content: TEMPLATE("Apple Genius specialized in Apple Watches"),
      },
    ],
    modelConfig: {
      model: "gpt-3.5-turbo-16k",
      temperature: 0.1,
      maxTokens: 8000,
      sendMemory: true,
    },
    readOnly: false,
    datasource: "watchos",
    hideContext: false,
  },
  {
    avatar: "1f4da",
    name: "German Basic Law Expert",
    botHello: "Hello! How can I assist you today?",
    context: [
      {
        role: "system",
        content: TEMPLATE("Lawyer specialized in the basic law of Germany"),
      },
    ],
    modelConfig: {
      model: "gpt-3.5-turbo-16k",
      temperature: 0.1,
      maxTokens: 8000,
      sendMemory: true,
    },
    readOnly: false,
    datasource: "basic_law_germany",
    hideContext: false,
  },
  {
    avatar: "1f5a5-fe0f",
    name: "IT Expert",
    botHello: "Hello! How can I assist you today?",
    context: [
      {
        role: "system",
        content:
          "I want you to act as an IT Expert. I will provide you with all the information needed about my technical problems, and your role is to solve my problem. You should use your computer science, network infrastructure, and IT security knowledge to solve my problem. Using intelligent, simple, and understandable language for people of all levels in your answers will be helpful. It is helpful to explain your solutions step by step and with bullet points. Try to avoid too many technical details, but use them when necessary. I want you to reply with the solution, not write any explanations.",
        date: "",
      },
    ],
    modelConfig: {
      model: "gpt-4",
      temperature: 1,
      maxTokens: 8000,
      sendMemory: true,
    },
    readOnly: false,
    hideContext: true,
  },
];

export const createDemoBots = (): Record<string, Bot> => {
  const map: Record<string, Bot> = {};
  DEMO_BOTS.forEach((demoBot) => {
    const bot: Bot = JSON.parse(JSON.stringify(demoBot));
    bot.id = nanoid();
    bot.session = createEmptySession();
    map[bot.id] = bot;
  });
  return map;
};

export const createEmptyBot = (): Bot => ({
  id: nanoid(),
  avatar: "1f916",
  name: Locale.Store.DefaultBotName,
  context: [],
  modelConfig: {
    model: "gpt-3.5-turbo-16k" as ModelType,
    temperature: 0.5,
    maxTokens: 6000,
    sendMemory: true,
  },
  readOnly: false,
  createdAt: Date.now(),
  botHello: Locale.Store.BotHello,
  hideContext: false,
  session: createEmptySession(),
});
