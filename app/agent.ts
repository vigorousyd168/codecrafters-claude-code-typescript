import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { toolDefinitions, executeTool } from "./tools";

let client: OpenAI | undefined;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }
    client = new OpenAI({
      apiKey: apiKey,
      baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    });
  }
  return client;
}

/**
 * Runs the model/tool loop on the given messages until the model replies without
 * tool calls, and returns that final reply. Mutates `messages` as the conversation grows.
 */
export async function runAgentLoop(messages: ChatCompletionMessageParam[]): Promise<string> {
  while (true) {
    const response = await getClient().chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages: messages,
      tools: toolDefinitions,
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("no choices in response");
    }

    const message = response.choices[0].message;
    messages.push(message);

    // function calls -> append result to messages and loop
    // otherwise, return the content
    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: await executeTool(toolCall.function.name, toolCall.function.arguments)
        });
      }
    }
    else {
      return message.content ?? "";
    }
  }
}
