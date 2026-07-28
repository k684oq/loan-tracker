import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

type ExportRow = {
  title: string
  author: string | null
  library: string
  status: string | null
  loan_date: string | null
  due_date: string | null
  return_date: string | null
  rank: string | null
  pickup_library: string | null
  pickup_deadline: string | null
}

const COLUMNS: { key: keyof ExportRow; label: string }[] = [
  { key: 'title', label: '書名' },
  { key: 'author', label: '著者' },
  { key: 'library', label: '図書館' },
  { key: 'status', label: '状態' },
  { key: 'loan_date', label: '貸出日/予約日' },
  { key: 'due_date', label: '返却期限' },
  { key: 'return_date', label: '返却日' },
  { key: 'rank', label: '状況/順位' },
  { key: 'pickup_library', label: '受取館' },
  { key: 'pickup_deadline', label: '取置期限' },
]

function csvEscape(value: string | null): string {
  const s = value ?? ''
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const library = searchParams.get('library') ?? ''
  const status = searchParams.get('status') ?? ''
  const q = searchParams.get('q') ?? ''

  let query = supabase
    .from('loan_records')
    .select(
      'title, author, library, status, loan_date, due_date, return_date, rank, pickup_library, pickup_deadline'
    )

  if (status === 'active') {
    // 一覧画面の「貸出中(未返却)」と同じ条件(返却期限不明の履歴データは除外)
    query = query
      .is('return_date', null)
      .neq('status', '予約中')
      .or('due_date.not.is.null,is_historical.eq.false')
  } else if (status === 'reserved') {
    query = query.eq('status', '予約中')
  }

  if (library) {
    query = query.eq('library', library)
  }
  if (q) {
    query = query.ilike('title', `%${q}%`)
  }

  query = query
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('loan_date', { ascending: false })

  const { data, error } = await query

  if (error) {
    return new Response(error.message, { status: 500 })
  }

  const header = COLUMNS.map((c) => c.label).join(',')
  const rows = ((data ?? []) as ExportRow[]).map((row) =>
    COLUMNS.map((c) => csvEscape(row[c.key])).join(',')
  )
  // Excelで開いたときの文字化けを防ぐためBOMを付与する
  const BOM = String.fromCharCode(0xfeff)
  const csv = BOM + [header, ...rows].join('\r\n') + '\r\n'

  const today = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="loan_records_${today}.csv"`,
    },
  })
}
