import { ParsedLoan } from './parseYokohama'

// 横須賀図書館の「予約中の本」一覧(タブ区切りの表)を解析する
// 通常行: No.\t状況\t順位\tタイトル\tシリーズ予約番号\t予約日\t予約待ち期限日\t取置期限日\t受取館\t連絡方法
// 「準備できました」でない(まだ順番待ちの)行は状況欄が空で、コピー時に
// 「No.」だけの行と、順位以降の列を含む行の2行に分かれてしまうため、
// 前の行が「No.のみ」だった場合は次の行と合成して1件として扱う
export function parseYokosukaReservation(text: string): ParsedLoan[] {
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
