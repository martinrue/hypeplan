export function getOpenAiApiKey(env: NodeJS.ProcessEnv = process.env): string {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY must be set in a .env file or passed in the environment",
    );
  }

  return apiKey;
}
