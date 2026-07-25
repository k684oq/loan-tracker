import { ParsedLoan } from './parseYokohama'

// 横浜市立図書館の「予約中の本」一覧ページのコピー&ペーストを解析する
// 「【図書】」直後の1行目を書名として扱う。コピー元によっては書名が
// 「[書名](URL)」というMarkdownリンク形式になることがあるため、その場合は
// URLを除いた書名部分だけを取り出す
// 「予約日:」の行が無い(貸出中の本)ブロックは自動的に除外される
export function parseYokohamaReservation(text: string): ParsedLoan[] {
  const results: ParsedLoan[] = []
  const blocks = text.split('【図書】').slice(1)

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    if (lines.length === 0) continue

    // 予約日(全角/半角ピリオドに対応)
    const dateMatch = block.match(
      /予約日[:：]\s*(\d{4})[.．](\d{1,2})[.．](\d{1,2})/
    )
    if (!dateMatch) continue // 貸出中の本(予約日なし)は除外

    const title = cleanTitle(lines[0])

    const metaLine = lines[1] ?? ''
    const segments = metaLine.split(/\s+--\s+/)
    const authorRaw = segments[0] ?? ''
    const authorMatch = authorRaw.match(/^(.+?)[／/]/)
    const author = authorMatch ? authorMatch[1].trim() : authorRaw.trim()
    const publisher = (segments[1] ?? '').trim()

    const pickupLibraryMatch = block.match(/受取館[:：]\s*(\S+)/)
    const pickupLibrary = pickupLibraryMatch
      ? pickupLibraryMatch[1].trim()
      : ''

    // 「準備中」「予約中(n位)」「受取可 YYYY.MM.DD」等の状況は、
    // 予約日の行の次の行に書かれているのでそれを状況/順位として扱う
    const dateLineIndex = lines.findIndex((l) => l.startsWith('予約日'))
    const rank = dateLineIndex >= 0 ? (lines[dateLineIndex + 1] ?? '') : ''

    const pickupDeadlineMatch = block.match(
      /取置期限日[:：]\s*(\d{4})[.．](\d{1,2})[.．](\d{1,2})/
    )
    const pickup_deadline = pickupDeadlineMatch
      ? `${pickupDeadlineMatch[1]}-${pickupDeadlineMatch[2].padStart(2, '0')}-${pickupDeadlineMatch[3].padStart(2, '0')}`
      : null

    const month = dateMatch[2].padStart(2, '0')
    const day = dateMatch[3].padStart(2, '0')

    results.push({
      title,
      author,
      publisher,
      loan_date: `${dateMatch[1]}-${month}-${day}`,
      library: '横浜市立図書館',
      status: '予約中',
      rank,
      pickup_library: pickupLibrary,
      pickup_deadline,
    })
  }

  return results
}

function cleanTitle(raw: string): string {
  const linkMatch = raw.match(/^\[(.+)\]\(.+\)$/)
  return linkMatch ? linkMatch[1].trim() : raw.trim()
}
