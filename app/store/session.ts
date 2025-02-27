import { nanoid } from "nanoid";
import { ChatControllerPool } from "../client/controller";
import { LLMApi, RequestMessage } from "../client/platforms/llm";
import { FileWrap } from "../utils/file";
import { getDetailContentFromFile } from "../client/fetch/file";
import { prettyObject } from "../utils/format";
import { fetchSiteContent, isURL } from "../client/fetch/url";
import { Bot } from "./bot";
import { Embedding, URLDetail } from "../client/fetch/url";

export type ChatMessage = RequestMessage & {
  date?: string;
  streaming?: boolean;
  isError?: boolean;
  id?: string;
  urlDetail?: URLDetail;
};

export function createMessage(override: Partial<ChatMessage>): ChatMessage {
  return {
    id: nanoid(),
    date: new Date().toLocaleString(),
    role: "user",
    content: "",
    ...override,
  };
}

export interface ChatSession {
  messages: ChatMessage[];
  clearContextIndex?: number;
}

export function createEmptySession(): ChatSession {
  return {
    messages: [],
  };
}

async function createTextInputMessage(content: string): Promise<ChatMessage> {
  if (isURL(content)) {
    const urlDetail = await fetchSiteContent(content);
    const userContent = urlDetail.content;
    delete urlDetail["content"]; // clean content in url detail as we already store it in the message
    console.log("[User Input] did get url detail: ", urlDetail, userContent);
    return createMessage({
      role: "user",
      content: userContent,
      urlDetail,
    });
  } else {
    return createMessage({
      role: "user",
      content: content,
    });
  }
}

async function createFileInputMessage(file: FileWrap): Promise<ChatMessage> {
  const fileDetail = await getDetailContentFromFile(file);
  const textContent = fileDetail.content;
  delete fileDetail["content"];
  console.log(
    "[User Input] did get file upload detail: ",
    fileDetail,
    textContent,
  );
  return createMessage({
    role: "user",
    content: textContent,
    urlDetail: fileDetail,
  });
}

function transformAssistantMessageForSending(
  message: ChatMessage,
): RequestMessage {
  const { content } = message;
  // messages with role URL are assistant messages that contain a URL - the content is already retrieved by context-prompt.tsx
  if (message.role !== "URL") return message;
  return {
    role: "assistant",
    content,
  };
}

async function createUserMessage(
  content: string,
  uploadedFile?: FileWrap,
): Promise<ChatMessage> {
  let userMessage: ChatMessage;
  if (uploadedFile) {
    userMessage = await createFileInputMessage(uploadedFile);
  } else {
    userMessage = await createTextInputMessage(content);
  }
  return userMessage;
}

export async function callSession(
  bot: Bot,
  session: ChatSession,
  content: string,
  callbacks: {
    onUpdateMessages: (messages: ChatMessage[]) => void;
  },
  uploadedFile?: FileWrap,
): Promise<ChatMessage | undefined> {
  const modelConfig = bot.modelConfig;

  let userMessage: ChatMessage;

  try {
    userMessage = await createUserMessage(content, uploadedFile);
  } catch (error: any) {
    // an error occurred when creating user message, show error message as bot message and don't call API
    const userMessage = createMessage({
      role: "user",
      content,
    });
    const botMessage = createMessage({
      role: "assistant",
      content: prettyObject({
        error: true,
        message: error.message || "Invalid user message",
      }),
    });
    // updating the session will trigger a re-render, so it will display the messages
    session.messages = session.messages.concat([userMessage, botMessage]);
    callbacks.onUpdateMessages(session.messages);
    return botMessage;
  }

  const botMessage: ChatMessage = createMessage({
    role: "assistant",
    streaming: true,
  });

  const contextPrompts = bot.context.slice();
  // get messages starting from the last clear context index (or all messages if there is no clear context index)
  const recentMessages = !session.clearContextIndex
    ? session.messages
    : session.messages.slice(session.clearContextIndex);
  let sendMessages = [
    ...contextPrompts,
    ...recentMessages.map(transformAssistantMessageForSending),
  ];

  // save user's and bot's message
  const savedUserMessage = {
    ...userMessage,
    content,
  };
  session.messages = session.messages.concat([savedUserMessage, botMessage]);
  callbacks.onUpdateMessages(session.messages);

  let embeddings: Embedding[] | undefined;
  let message;
  if (userMessage.urlDetail) {
    // if the user sends document, let the LLM summarize the content of the URL and just use the document's embeddings
    message = "Summarize the given context briefly in 200 words or less";
    embeddings = userMessage.urlDetail?.embeddings;
    sendMessages = [];
  } else {
    // collect embeddings of all messages
    message = userMessage.content;
    embeddings = session.messages
      .flatMap((message: ChatMessage) => message.urlDetail?.embeddings)
      .filter((m) => m !== undefined) as Embedding[];
    embeddings = embeddings.length > 0 ? embeddings : undefined;
  }

  // make request
  let result;
  const controller = new AbortController();
  ChatControllerPool.addController(bot.id, controller);
  const api = new LLMApi();
  await api.chat({
    datasource: bot.datasource,
    embeddings,
    message: message,
    chatHistory: sendMessages,
    config: modelConfig,
    controller,
    onUpdate(message) {
      if (message) {
        botMessage.content = message;
        callbacks.onUpdateMessages(session.messages.concat());
      }
    },
    onFinish(memoryMessage?: RequestMessage) {
      botMessage.streaming = false;
      if (memoryMessage) {
        // all optional memory message returned by the LLM
        const newChatMessages = createMessage({ ...memoryMessage });
        session.messages = session.messages.concat(newChatMessages);
      }
      callbacks.onUpdateMessages(session.messages.concat());
      ChatControllerPool.remove(bot.id);
      // TODO: check send memory message to telegram
      result = botMessage;
    },
    onError(error) {
      const isAborted = error.message.includes("aborted");
      botMessage.content +=
        "\n\n" +
        prettyObject({
          error: true,
          message: error.message,
        });
      botMessage.streaming = false;
      userMessage.isError = !isAborted;
      botMessage.isError = !isAborted;
      callbacks.onUpdateMessages(session.messages);
      ChatControllerPool.remove(bot.id);

      console.error("[Chat] failed ", error);
      result = botMessage;
    },
  });
  return result;
}
