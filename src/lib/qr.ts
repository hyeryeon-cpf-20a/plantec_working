import QRCode from 'qrcode'

/**
 * 하트 모양 QR 코드.
 * QR 코드를 45° 돌려 마름모(◆)로 하트의 몸통을 만들고, 위쪽 두 변에 반원 두 개를 붙여 하트를 완성합니다.
 * 반원 부분은 QR 과 같은 모양·색의 점으로 채워 하트 전체가 QR 처럼 보이게 합니다.
 * (인식에 필요한 모서리 위치 표시 주변만 한 칸 비워 둡니다)
 */
export async function heartQrDataUrl(text: string, opts: { dark: string; size?: number }): Promise<string> {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' })
  const m = qr.modules.size
  const data = qr.modules.data
  const R = m / 2 // 반원 반지름 (마름모 한 변의 절반)

  // 격자 좌표 (u: 가로, v: 세로) — QR 은 [0, m) × [0, m)
  // 반원: u = 0 변 바깥쪽(u<0), v = 0 변 바깥쪽(v<0)
  const inLobe = (u: number, v: number) =>
    (u < 0 && (u + 0.5) ** 2 + (v + 0.5 - R) ** 2 <= R * R) || (v < 0 && (v + 0.5) ** 2 + (u + 0.5 - R) ** 2 <= R * R)
  // 모서리 위치 표시(7×7) 둘레 한 칸은 비워 둠
  const nearFinder = (u: number, v: number) => {
    const boxes = [
      [0, 0],
      [m - 7, 0],
      [0, m - 7],
    ]
    return boxes.some(([bu, bv]) => u >= bu - 1 && u <= bu + 7 && v >= bv - 1 && v <= bv + 7)
  }

  const size = opts.size ?? 1200
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)

  // 45° 돌린 하트의 바깥 경계 (회전 좌표: x = (u − v)/√2, y = (u + v)/√2)
  //  - 반원 중심 (0, R)·(R, 0) → x = ∓R/√2, y = R/√2  → 가장 바깥 = 중심 ± R
  //  - 아래 꼭짓점 (m, m) → y = √2·m
  const S = Math.SQRT2
  const maxX = R / S + R
  const minX = -maxX
  const topY = R / S - R
  const bottomY = S * m
  const w = maxX - minX
  const h = bottomY - topY
  const pad = size * 0.07
  const cell = (size - pad * 2) / Math.max(w, h)
  const ox = size / 2 - ((minX + maxX) / 2) * cell
  const oy = pad + (size - pad * 2 - h * cell) / 2 - topY * cell

  ctx.save()
  ctx.translate(ox, oy)
  ctx.rotate(Math.PI / 4)
  ctx.fillStyle = opts.dark
  const sq = (u: number, v: number) => ctx.fillRect(u * cell, v * cell, cell + 0.6, cell + 0.6)

  // 1) 위쪽 반원 두 개 — QR 과 같은 점무늬(무작위)로 채움
  let seed = 11
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  for (let v = Math.floor(-R) - 1; v < m; v++)
    for (let u = Math.floor(-R) - 1; u < m; u++) {
      if (!inLobe(u, v) || nearFinder(u, v)) continue
      if (rnd() < 0.5) sq(u, v)
    }

  // 2) 실제 QR 코드
  for (let v = 0; v < m; v++)
    for (let u = 0; u < m; u++) if (data[v * m + u]) sq(u, v)
  ctx.restore()

  return canvas.toDataURL('image/png')
}
