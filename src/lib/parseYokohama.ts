export type ParsedLoan = {
  title: string
  author: string
  publisher: string
  loan_date: string
}

// 横浜市立図書館の「貸出中の本」一覧ページのコピー&ペーストを解析する
// 「予約中の本」セクションは 貸出日: が無いため自動的に除外される
// 分類番号と「貸出日:」の間に改行がある/ないどちらのレイアウトにも対応
export function parseYokohamaLending(text: string): ParsedLoan[] {
  const results: ParsedLoan[] = []
  const blocks = text.split('【図書】').slice(1)

  for (const block of blocks) {
    const titleMatch = block.match(/\[(.+?)\]\([^)]*\)/)
    if (!titleMatch) continue
    const title = titleMatch[1].trim()

    const bibMatch = block.match(/(.+?)／著\s*--\s*(.+?)\s*--/)
    if (!bibMatch) continue
    const author = bibMatch[1].trim()
    const publisher = bibMatch[2].trim()

    const dateMatch = block.match(/貸出日:(\d{4})\.(\d{2})\.(\d{2})/)
    if (!dateMatch) continue // 予約中の本(貸出日なし)は除外

    results.push({
      title,
      author,
      publisher,
      loan_date: `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`,
    })
  }

  return results
}
