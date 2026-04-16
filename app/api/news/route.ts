import { NextResponse } from 'next/server'

const RSS_FEEDS = [
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147', source: 'CNBC' },  // World Markets
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069', source: 'CNBC' },  // Earnings
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910', source: 'CNBC' },  // Europe News
]

interface NewsItem {
  text: string
  url: string
  tag: string
  positive: boolean
  date: string
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

function parseRssItems(xml: string): Array<{ title: string; link: string; pubDate: string }> {
  const items: Array<{ title: string; link: string; pubDate: string }> = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const rawTitle = block.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/)?.[1] || block.match(/<title>(.*?)<\/title>/)?.[1] || ''
    const title = decodeHtmlEntities(rawTitle)
    const link = block.match(/<link>(.*?)<\/link>/)?.[1] || ''
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
    if (title && link) {
      items.push({ title: title.trim(), link: link.trim(), pubDate: pubDate.trim() })
    }
  }
  return items
}

function categorize(title: string): { tag: string; positive: boolean } {
  const lower = title.toLowerCase()

  if (/earnings|beats|misses|revenue|profit|eps|quarter|q[1-4]/i.test(lower)) {
    const positive = !/miss|fall|drop|decline|disappoint|below|loss|warn/i.test(lower)
    return { tag: 'Earnings', positive }
  }
  if (/europe|dax|cac|stoxx|ftse|ecb|kering|lvmh|hermes|sanofi/i.test(lower)) {
    const positive = !/fall|drop|decline|slide|sink|loss|lower|down/i.test(lower)
    return { tag: 'Europe', positive }
  }
  if (/iran|war|geopolit|tariff|sanction|tension|conflict|missile|strike/i.test(lower)) {
    return { tag: 'Geopolitique', positive: false }
  }
  if (/fed|rate|inflation|cpi|gdp|jobs|employment|treasury|bond|yield/i.test(lower)) {
    const positive = !/fall|drop|decline|fear|concern|warn|risk|recession/i.test(lower)
    return { tag: 'Macro', positive }
  }
  if (/oil|gold|commodit|crude|wti|brent|copper|silver/i.test(lower)) {
    const positive = /rise|gain|jump|surge|rally|climb|high/i.test(lower)
    return { tag: 'Commodities', positive }
  }
  if (/s&p|nasdaq|dow|record|high|rally|surge|gain|climb/i.test(lower)) {
    const positive = !/fall|drop|decline|slide|sell|loss|lower|down/i.test(lower)
    return { tag: 'Indices', positive }
  }

  const positive = /rise|gain|jump|surge|rally|climb|up|high|beat|record|strong/i.test(lower)
  return { tag: 'Markets', positive }
}

export async function GET() {
  try {
    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000
    const allItems: NewsItem[] = []
    const seenTitles = new Set<string>()

    const fetches = RSS_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 900 }, // cache 15 min
        })
        if (!res.ok) return []
        const xml = await res.text()
        return parseRssItems(xml)
      } catch {
        return []
      }
    })

    const results = await Promise.all(fetches)

    for (const items of results) {
      for (const item of items) {
        const pubTime = new Date(item.pubDate).getTime()
        if (isNaN(pubTime) || pubTime < twelveHoursAgo) continue

        const titleKey = item.title.toLowerCase().slice(0, 60)
        if (seenTitles.has(titleKey)) continue
        seenTitles.add(titleKey)

        const { tag, positive } = categorize(item.title)
        allItems.push({
          text: item.title,
          url: item.link,
          tag,
          positive,
          date: item.pubDate,
        })
      }
    }

    // Sort by date descending, limit to 8
    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const news = allItems.slice(0, 8)

    return NextResponse.json({ news, updatedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json({ news: [], updatedAt: new Date().toISOString() })
  }
}
