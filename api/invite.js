// Vercel 서버리스 함수: /invite/:slug 요청에 게시된 초대장의 제목·설명·대표 이미지를
// Open Graph 메타 태그로 넣어 줍니다. (카카오톡·문자 링크 미리보기용)
// 나머지 화면은 동일한 SPA(index.html)가 그대로 렌더링합니다.

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function imageUrl(img, supabaseUrl, origin) {
  if (!img) return null
  if (img.path) return `${supabaseUrl}/storage/v1/object/public/media/${img.path.split('/').map(encodeURIComponent).join('/')}`
  if (img.url) return new URL(img.url, origin).toString()
  return null
}

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const origin = `${proto}://${host}`
  const slug = String(req.query.slug || '').replace(/[^a-z0-9-]/g, '').slice(0, 50) || process.env.VITE_DEFAULT_SLUG || 'event'

  let html
  try {
    const r = await fetch(`${origin}/index.html`)
    html = await r.text()
  } catch {
    res.status(502).send('index.html unavailable')
    return
  }

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (url && key) {
    try {
      const r = await fetch(`${url}/rest/v1/rpc/get_public_invitation`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ p_slug: slug }),
      })
      const data = r.ok ? await r.json() : null
      const c = data?.content
      if (c?.share) {
        const hero = (c.sections || []).find((s) => s.type === 'hero')
        const img = c.share.ogImagePath
          ? imageUrl({ path: c.share.ogImagePath }, url, origin)
          : imageUrl(c.share.image || hero?.settings?.bgImage, url, origin)
        const title = esc(c.share.title)
        const desc = esc(String(c.share.description || '').replace(/\n/g, ' '))
        const pageUrl = req.query.slug ? `${origin}/invite/${slug}` : `${origin}/`
        const tags = [
          `<title>${title}</title>`,
          `<meta name="description" content="${desc}" />`,
          `<meta property="og:type" content="website" />`,
          `<meta property="og:url" content="${esc(pageUrl)}" />`,
          `<meta property="og:title" content="${title}" />`,
          `<meta property="og:description" content="${desc}" />`,
          img ? `<meta property="og:image" content="${esc(img)}" />` : '',
          img && c.share.ogImagePath ? `<meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />` : '',
          `<meta name="twitter:card" content="summary_large_image" />`,
        ].join('\n    ')
        html = html.replace(/<!--og:start-->[\s\S]*?<!--og:end-->/, tags)
      }
    } catch {
      /* 미리보기 정보를 못 가져와도 페이지는 정상 제공 */
    }
  }
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.setHeader('cache-control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600')
  res.status(200).send(html)
}
