import prisma from './db'

export async function resolveApiKeys(userId: string): Promise<{
  elevenLabsKey: string
  openRouterKey: string
}> {
  // 1. Check user's own keys
  const userKeys = await prisma.userApiKeys.findUnique({ where: { userId } })

  let elevenLabsKey = userKeys?.elevenLabsKey || ''
  let openRouterKey = userKeys?.openRouterKey || ''

  // 2. Fall back to site-wide admin config
  if (!elevenLabsKey) {
    const siteEl = await prisma.siteConfig.findUnique({ where: { key: 'elevenlabs_api_key' } })
    elevenLabsKey = siteEl?.value || ''
  }
  if (!openRouterKey) {
    const siteOr = await prisma.siteConfig.findUnique({ where: { key: 'openrouter_api_key' } })
    openRouterKey = siteOr?.value || ''
  }

  // 3. Fall back to environment variables
  if (!elevenLabsKey) elevenLabsKey = process.env.ELEVENLABS_API_KEY || ''
  if (!openRouterKey) openRouterKey = process.env.OPENROUTER_API_KEY || ''

  return { elevenLabsKey, openRouterKey }
}
