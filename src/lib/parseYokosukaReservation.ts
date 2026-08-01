import { ParsedLoan } from './parseYokohama'

// 横須賀図書館の「予約中の本」一覧を解析する。
// PCブラウザでのコピーはタブ区切りの表になるが、スマホ(iOS Safari等)での
// コピーはテーブル構造が失われ、ラベルと値が改行なしで連結された1本の
// テキストになる。両方の抽出方式を試し、結果を合成する

// --- PC(タブ区切り)版 ---
// 通常行: No.\t状況\t順位\tタイトル\tシリーズ予約番号\t予約日\t予約待ち期限日\t取置期限日\t受取館\t連絡方法
// 「準備できました」でない(まだ順番待ちの)行は状況欄が空で、コピー時に
// 「No.」だけの行と、順位以降の列を含む行の2行に分かれてしまうため、
// 前の行が「No.のみ」だった場合は次の行と合成して1件として扱う
function parseTabSeparated(text: string): ParsedLoan[] {
  const results: ParsedLoan[] = []
  const lines = text.split('\n')

  let pendingNo: string | null = null

  for (const line of lines) {
    const cols = line.split('\t')

    if (pendingNo !== null) {
      const rank = (cols[0] ?? '').trim()
      const title = (cols[1] ?? '').trim()
      const reservationDateRaw = (cols[3] ?? '').trim()
      const pickupDeadlineRaw = (cols[5] ?? '').trim()
      const pickupLibrary = (cols[6] ?? '').trim()

      pendingNo = null
      pushRow(results, { rank, title, reservationDateRaw, pickupDeadlineRaw, pickupLibrary })
      continue
    }

    const rowNo = (cols[0] ?? '').trim()
    if (!/^\d+$/.test(rowNo)) continue // ヘッダー行・空行は除外

    const isLoneNoLine = cols.slice(1).every((c) => c.trim() === '')
    if (isLoneNoLine) {
      pendingNo = rowNo
      continue
    }

    const status = (cols[1] ?? '').trim()
    const title = (cols[3] ?? '').trim()
    const reservationDateRaw = (cols[5] ?? '').trim()
    const pickupDeadlineRaw = (cols[7] ?? '').trim()
    const pickupLibrary = (cols[8] ?? '').trim()

    pushRow(results, {
      rank: status, // 「準備できました」を順位欄の代わりに記録する
      title,
      reservationDateRaw,
      pickupDeadlineRaw,
      pickupLibrary,
    })
  }

  return results
}

// --- スマホ版(改行なしの連結テキスト) ---
// 「1.書名準備中です予約日:2026/08/01予約待ち期限日:受取館:児童連絡方法:不要連絡先:」のように
// 連番+書名+状況(「準備中です」「準備できました」または「予約待ち(順位 / 総数)」)に続けて
// ラベル付きの値が改行なしで並ぶ。取置期限日は値がある場合のみ現れ、「受取館」の直後の
// 「児童」は対象読者区分などの固定的な補足文言でアプリでは使わないため読み飛ばす。
// キャンセル可能な予約は末尾に「受取館を変更する…」等のリンク文言が付くが、次の項目境界
// (次の連番+「.」、または文末)の手前までを連絡先欄として読み捨てるため影響しない
const MOBILE_ENTRY_REGEX =
  /(\d{1,3})\.([\s\S]+?)(準備中です|準備できました|予約待ち\(\s*\d+\s*\/\s*\d+\s*\))予約日[:：]\s*(\d{4}\/\d{1,2}\/\d{1,2})?予約待ち期限日[:：]\s*(\d{4}\/\d{1,2}\/\d{1,2})?(?:取置期限日[:：]\s*(\d{4}\/\d{1,2}\/\d{1,2})?)?受取館[:：]\s*([\s\S]*?)児童?連絡方法[:：]\s*(要|不要)連絡先[:：]\s*([\s\S]*?)(?=\d{1,3}\.(?!\d)|$)/g

function parseMobileConcatenated(text: string): ParsedLoan[] {
  const results: ParsedLoan[] = []

  for (const m of text.matchAll(MOBILE_ENTRY_REGEX)) {
    const title = m[2].trim()
    const rank = m[3]
    const reservationDateRaw = m[4] ?? ''
    const pickupDeadlineRaw = m[6] ?? ''
    const pickupLibrary = (m[7] ?? '').trim()

    pushRow(results, { rank, title, reservationDateRaw, pickupDeadlineRaw, pickupLibrary })
  }

  return results
}

export function parseYokosukaReservation(text: string): ParsedLoan[] {
  return [...parseTabSeparated(text), ...parseMobileConcatenated(text)]
}

function pushRow(
  results: ParsedLoan[],
  args: {
    rank: string
    title: string
    reservationDateRaw: string
    pickupDeadlineRaw: string
    pickupLibrary: string
  }
) {
  const { rank, title, reservationDateRaw, pickupDeadlineRaw, pickupLibrary } = args
  if (!title) return

  const reservationDate = toIsoDate(reservationDateRaw)
  if (!reservationDate) return

  results.push({
    title,
    author: '',
    publisher: '',
    loan_date: reservationDate,
    library: '横須賀図書館',
    status: '予約中',
    rank,
    pickup_library: pickupLibrary,
    pickup_deadline: toIsoDate(pickupDeadlineRaw),
  })
}

function toIsoDate(raw: string): string | null {
  const m = raw.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/)
  if (!m) return null
  const month = m[2].padStart(2, '0')
  const day = m[3].padStart(2, '0')
  return `${m[1]}-${month}-${day}`
}
