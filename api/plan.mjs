import { handlePlanRequest } from '../server/planHandler.mjs'

// Vercel Hobby caps functions at 60s. Plan generation with adaptive thinking can
// run longer than that; if it is cut off the client falls back to the offline
// planner rather than failing, and a Pro plan can raise this to 300.
export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  await handlePlanRequest(req, res)
}
