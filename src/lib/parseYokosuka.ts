import { ParsedLoan } from './parseYokohama'

// 横須賀図書館の「貸出中」一覧(タブ区切りの表)を解析する
// 各行は「No.\t貸出延長\tタイトル\t区分\tバーコード番号\t貸出館\t貸出日\t返却期限日」の
// タブ区切りになっており、先頭列が数字の行だけを本のデータ行として扱う
export function parseYokosukaLending(text: string): ParsedLoan[] {
  const results: ParsedLoan[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    const cols = line.split('\t')
    const rowNo = (cols[0] ?? '').trim()
    if (!/^\d+$/.test(rowNo)) continue // ヘッダー行・継続行は除外
    if (cols.length < 8) continue

    const title = (cols[2] ?? '').trim()
    const loanDateRaw = (cols[6] ?? '').trim()
    const dateMatch = loanDateRaw.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/)
    if (!title || !dateMatch) continue

    const month = dateMatch[2].padStart(2, '0')
    const day = dateMatch[3].padStart(2, '0')

    results.push({
      title,
      author: '',
      publisher: '',
      loan_date: `${dateMatch[1]}-${month}-${day}`,
      library: '横須賀図書館',
    })
  }

  return results
}
