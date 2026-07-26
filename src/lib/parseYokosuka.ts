import { ParsedLoan } from './parseYokohama'

// 横須賀図書館の「貸出中」一覧(タブ区切りの表)を解析する
// 通常は「(No.\t)(貸出延長\t)タイトル\t区分\tバーコード番号\t貸出館\t貸出日\t返却期限日」の
// タブ区切りだが、延長上限に達している本は「延長上限回数に達しました。」等の警告文が
// 追加の列として先頭側に挿入され、以降の列が丸ごと右にずれる。
// そのため列番号を固定せず、バーコード番号(数字のみ6桁以上)を手がかりに
// 「バーコード番号の2つ前」をタイトル列として検出し、列ズレの影響を受けないようにする。
// バーコード番号より前に余分な列があり、そこに「延長」の文字が含まれていれば
// 延長上限到達などで延長できない本と判定する
export function parseYokosukaLending(text: string): ParsedLoan[] {
  const results: ParsedLoan[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    const cols = line.split('\t').map((c) => c.trim())

    const barcodeIndex = cols.findIndex((c) => /^\d{6,}$/.test(c))
    if (barcodeIndex < 2) continue // タイトル列が存在しない行は除外

    const title = cols[barcodeIndex - 2]
    if (!title) continue

    const dateFields = cols
      .slice(barcodeIndex + 1)
      .filter((c) => /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(c))
    if (dateFields.length < 2) continue // 貸出日・返却期限日が揃っていない行は除外

    const toIso = (raw: string) => {
      const m = raw.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/)!
      return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
    }

    const leadingCols = cols.slice(0, barcodeIndex - 2)
    const renewed = !leadingCols.some((c) => c.includes('延長'))

    results.push({
      title,
      author: '',
      publisher: '',
      loan_date: toIso(dateFields[0]),
      library: '横須賀図書館',
      due_date: toIso(dateFields[1]),
      renewed,
    })
  }

  return results
}
