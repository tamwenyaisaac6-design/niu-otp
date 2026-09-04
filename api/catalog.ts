import type { VercelRequest, VercelResponse } from '@vercel/node'

const baseUrl = process.env.VIRTUALSMS_API_URL ?? 'https://api.virtualsms.de/stubs/handler_api'
const apiKey = process.env.VIRTUALSMS_API_KEY
const multiplier = Number(process.env.PRICE_MULTIPLIER ?? '2')

async function provider(action: string, params: Record<string, string> = {}) {
  if (!apiKey) throw new Error('VirtualSMS API key is not configured')
  const query = new URLSearchParams({ action, api_key: apiKey, ...params })
  const response = await fetch(`${baseUrl}?${query}`)
  if (!response.ok) throw new Error(`VirtualSMS returned ${response.status}`)
  return response.json()
}

export default async function handler(_request: VercelRequest, response: VercelResponse) {
  try {
    const rawCountries = await provider('getCountries') as Record<string, { id: number; eng: string; visible: number }>
    const countries = Object.values(rawCountries).filter((country) => country.visible !== 0).map((country) => ({ id: country.id, name: country.eng }))
    const servicesByCountry = await Promise.all(countries.map(async (country) => {
      const data = await provider('getServicesList', { country: String(country.id) }) as { services?: Array<{ code: string; name: string }> }
      const services = await Promise.all((data.services ?? []).map(async (service) => {
        const prices = await provider('getPrices', { country: String(country.id), service: service.code }) as Record<string, Record<string, { cost: number; count: number }>>
        const offer = prices[String(country.id)]?.[service.code]
        return offer && offer.count > 0 ? { ...service, providerPrice: offer.cost, customerPrice: Math.round(offer.cost * multiplier * 100) / 100, stock: offer.count } : null
      }))
      return { ...country, services: services.filter((service): service is NonNullable<typeof service> => service !== null) }
    }))
    return response.status(200).json({ countries: servicesByCountry.filter((country) => country.services.length > 0), multiplier })
  } catch (error) {
    console.error('VirtualSMS catalog error:', error)
    return response.status(502).json({ error: 'Live provider catalog is unavailable' })
  }
}
