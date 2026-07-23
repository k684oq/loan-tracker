export type ParsedLoan = {
  title: string
  author: string
  publisher: string
  loan_date: string
}

// 横浜市立図書館の「貸出中の本」一覧ページのコピー&ペーストを解析する
// 「予約中の本」セクションは 貸出日: が無いため自動的に除外される
export function parseYokohamaLending(text: string): ParsedLoan[] {
  const results: ParsedLoan[] = []
  const blockRegex =
    /【図書】\s*\[(.+?)\]\([^)]*\)\s*\n(.+?)\n貸出日:(\d{4})\.(\d{2})\.(\d{2})/g

  let m: RegExpExecArray | null
  while ((m = blockRegex.exec(text)) !== null) {
    const title = m[1].trim()
    const bibLine = m[2].trim()
    const year = m[3]
    const month = m[4]
    const day = m[5]

    const parts = bibLine.split('--').map((s) => s.trim())
    const authorRaw = parts[0] || ''
    const author = authorRaw.replace(/／著.*$/, '').trim()
    const publisher = parts[1] || ''

    results.push({
      title,
      author,
      publisher,
      loan_date: `${year}-${month}-${day}`,
    })
  }

  return results
}
