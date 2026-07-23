export type ParsedLoan = {
  title: string
  author: string
  publisher: string
  loan_date: string
}

// 横浜市立図書館の「貸出中の本」一覧ページのコピー&ペーストを解析する
// 「予約中の本」セクションは 貸出日: が無いため自動的に除外される
// スラッシュ・コロンの全角/半角、改行有無などレイアウトの揺れに対応
export function parseYokohamaLending(text: string): ParsedLoan[] {
  const results: ParsedLoan[] = []
  const blocks = text.split('【図書】').slice(1)

  for (const block of blocks) {
    const titleMatch = block.match(/\[(.+?)\]\([^)]*\)/)
    if (!titleMatch) continue
    const title = titleMatch[1].trim()

    // 貸出日(全角/半角コロン、全角/半角ピリオドに対応)
    const dateMatch = block.match(
      /貸出日[:：]\s*(\d{4})[.\uFF0E](\d{1,2})[.\uFF0E](\d{1,2})/
    )
    if (!dateMatch) continue // 予約中の本(貸出日なし)は除外

    // 著者(全角/半角スラッシュに対応)
    const authorMatch = block.match(/([^\n]+?)[／/]著/)
    const author = authorMatch ? authorMatch[1].trim() : ''

    // 出版社(取得できなくても登録自体は継続)
    let publisher = ''
    const pubMatch = block.match(/[／/]著\s*[-―ー－]+\s*(.+?)\s*[-―ー－]{2,}/)
    if (pubMatch) publisher = pubMatch[1].trim()

    const month = dateMatch[2].padStart(2, '0')
    const day = dateMatch[3].padStart(2, '0')

    results.push({
      title,
      author,
      publisher,
      loan_date: `${dateMatch[1]}-${month}-${day}`,
    })
  }

  return results
}
