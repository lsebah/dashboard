import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://wttr.in/Paris?format=j1', {
      next: { revalidate: 1800 }, // cache 30 min
    })
    const data = await res.json()

    const current = data.current_condition?.[0]
    const today = data.weather?.[0]

    return NextResponse.json({
      location: 'Paris',
      temp: current?.temp_C ?? '--',
      feelsLike: current?.FeelsLikeC ?? '--',
      high: today?.maxtempC ?? '--',
      low: today?.mintempC ?? '--',
      description: current?.lang_fr?.[0]?.value ?? current?.weatherDesc?.[0]?.value ?? '',
      icon: current?.weatherCode ?? '116',
    })
  } catch {
    return NextResponse.json({
      location: 'Paris',
      temp: '--',
      feelsLike: '--',
      high: '--',
      low: '--',
      description: 'Indisponible',
      icon: '116',
    })
  }
}
