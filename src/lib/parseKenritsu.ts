import { ParsedLoan } from './parseYokohama'

// 神奈川県立図書館の「貸出中の本」一覧ページのコピー&ペーストを解析する
// 「【図書】」直後の最初の非空行を書名として扱う。
// 著者情報の行は「著者名／著 -- 出版社 -- 出版年月 -- 分類記号」の形式で、
// ／の直後の表記(著・編・訳・［著］など)は問わず、／より前を著者名として扱う。
// 「貸出日:」が無い(予約中の本)は自動的に除外される
export function parseKenritsuLending(text: string): ParsedLoan[] {
  const results: ParsedLoan[] = []
  const blocks = text.split('【図書】').slice(1)

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    if (lines.length === 0) continue
    const title = lines[0]

    const dateMatch = block.match(
      /貸出日[:：]\s*(\d{4})\/(\d{1,2})\/(\d{1,2})/
    )
    if (!dateMatch) continue // 予約中の本(貸出日なし)は除外

    const metaLine = lines[1] ?? ''
    const segments = metaLine.split(/\s+--\s+/)
    const authorRaw = segments[0] ?? ''
    const authorMatch = authorRaw.match(/^(.+?)[／/]/)
    const author = authorMatch ? authorMatch[1].trim() : authorRaw.trim()
    const publisher = (segments[1] ?? '').trim()

    const month = dateMatch[2].padStart(2, '0')
    const day = dateMatch[3].padStart(2, '0')

    results.push({
      title,
      author,
      publisher,
      loan_date: `${dateMatch[1]}-${month}-${day}`,
      library: '神奈川県立図書館',
    })
  }

  return results
}
