import { handleAiRequest } from '../server/aiHandler.mjs'

// A week of new recipes with adaptive thinking can take a while; Hobby caps this at 60s, Pro allows 300.
export const config = { maxDuration: 300 }

export default async function handler(req, res) {
  await handleAiRequest(req, res)
}
