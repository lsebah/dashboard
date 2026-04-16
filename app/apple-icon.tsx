import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2c5068',
          borderRadius: '32px',
        }}
      >
        <span
          style={{
            fontSize: '58px',
            fontWeight: 700,
            color: 'white',
            letterSpacing: '2px',
          }}
        >
          CMF
        </span>
      </div>
    ),
    { ...size },
  )
}
