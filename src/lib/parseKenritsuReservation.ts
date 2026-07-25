import { ParsedLoan } from './parseYokohama'

// 神奈川県立図書館の「予約中の本」一覧ページのコピー&ペーストを解析する
// 「【図書】」直後の1行目を書名として扱う。
// 「予約状態」(利用可能/返却待ち等)と「予約順位」(n位)を結合して状況/順位として扱う。
// 「予約順位：」の行の末尾に「取置期限日:」が続けて書かれている場合があるため、
// 取置期限日部分を切り離してから順位の値を取り出す。
// 「予約日:」の行が無い(貸出中の本)ブロックは自動的に除外される
export function parseKenritsuReservation(text: string): ParsedLoan[] {
  const results: ParsedLoan[] = []
  const blocks = text.split('【図書】').slice(1)

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    if (lines.length === 0) continue

    const dateMatch = block.match(
      /予約日[:：]\s*(\d{4})\/(\d{1,2})\/(\d{1,2})/
    )
    if (!dateMatch) continue // 貸出中の本(予約日なし)は除外

    const title = lines[0]

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

    const statusMatch = block.match(/予約状態[:：]\s*(\S+)/)
    const statusText = statusMatch ? statusMatch[1].trim() : ''

    const rankLine = lines.find((l) => l.includes('予約順位')) ?? ''
    const rankValue = rankLine
      .split('取置期限日')[0]
      .replace(/予約順位[:：]/, '')
      .trim()
    const rank = rankValue ? `${statusText} (${rankValue})` : statusText

    const pickupDeadlineMatch = block.match(
      /取置期限日[:：]\s*(\d{4})\/(\d{1,2})\/(\d{1,2})/
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
      library: '神奈川県立図書館',
      status: '予約中',
      rank,
      pickup_library: pickupLibrary,
      pickup_deadline,
    })
  }

  return results
}
