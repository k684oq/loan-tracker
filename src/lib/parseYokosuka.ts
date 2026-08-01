import { ParsedLoan } from './parseYokohama'

// 横須賀図書館の「貸出中」一覧を解析する。
// PCブラウザでのコピーはタブ区切りの表になるが、スマホでのコピーは
// 「N. 書名\n種別:図書\nバーコード:...\n貸出館:...\n貸出日:...\n返却期限日:...\n
// (延長できません(理由)|返却期限日を更新する)\n今度読みたい本に追加」のように
// ラベル:値が改行区切りで並ぶ別形式になる。両方の抽出方式を試し、結果を合成する

// --- PC(タブ区切り)版 ---
// 通常は「(No.\t)(貸出延長\t)タイトル\t区分\tバーコード番号\t貸出館\t貸出日\t返却期限日」の
// タブ区切りだが、延長上限に達している本は「延長上限回数に達しました。」等の警告文が
// 追加の列として先頭側に挿入され、以降の列が丸ごと右にずれる。
// そのため列番号を固定せず、バーコード番号(数字のみ6桁以上)を手がかりに
// 「バーコード番号の2つ前」をタイトル列として検出し、列ズレの影響を受けないようにする。
// バーコード番号より前に余分な列があり、そこに「延長」の文字が含まれていれば
// 延長上限到達などで延長できない本と判定する
function parseTabSeparated(text: string): ParsedLoan[] {
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

// --- スマホ版(ラベル:値が改行区切りで並ぶ形式) ---
// 「延長できません(理由)」があれば延長不可、「返却期限日を更新する」(延長リンク)が
// あれば延長可能と判定する。次の項目境界(次の連番+「. 」、または文末)の手前までを
// 判定対象の範囲として扱う
const MOBILE_LENDING_REGEX =
  /(?:^|\n)(\d{1,3})[.．]\s*([^\n]+)\n[\s\S]*?バーコード[:：]\s*(\d+)[\s\S]*?貸出日[:：]\s*(\d{4}\/\d{1,2}\/\d{1,2})[\s\S]*?返却期限日[:：]\s*(\d{4}\/\d{1,2}\/\d{1,2})([\s\S]*?)(?=(?:\n\d{1,3}[.．]\s)|$)/g

function parseMobileLineBased(text: string): ParsedLoan[] {
  const results: ParsedLoan[] = []

  for (const m of text.matchAll(MOBILE_LENDING_REGEX)) {
    const title = m[2].trim()
    const loanDateRaw = m[4]
    const dueDateRaw = m[5]
    const trailer = m[6]

    const toIsoOrNull = (raw: string) => {
      const dm = raw.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/)
      if (!dm) return null
      return `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}`
    }

    const loan_date = toIsoOrNull(loanDateRaw)
    const due_date = toIsoOrNull(dueDateRaw)
    if (!loan_date || !due_date) continue

    let renewed: boolean | undefined
    if (trailer.includes('延長できません')) renewed = false
    else if (trailer.includes('更新する')) renewed = true

    results.push({
      title,
      author: '',
      publisher: '',
      loan_date,
      library: '横須賀図書館',
      due_date,
      renewed,
    })
  }

  return results
}

export function parseYokosukaLending(text: string): ParsedLoan[] {
  return [...parseTabSeparated(text), ...parseMobileLineBased(text)]
}
