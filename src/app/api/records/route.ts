import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ParsedLoan } from '@/lib/parseYokohama'

// /add ページの「Supabaseに登録する」から呼ばれる。
// 重複防止: 同じ図書館で「書名+貸出日」が既に登録済みの行はスキップする。
// 返却期限日は、延長によって貼り付けたデータの値が既存レコードと変わっていれば更新し、
// 延長可否(renewed)は貼り付けるたびに最新の状態へ更新する
export async function POST(request: Request) {
  const { rows } = (await request.json()) as { rows: ParsedLoan[] }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '登録する行がありません' }, { status: 400 })
  }

  const libraries = Array.from(new Set(rows.map((r) => r.library)))
  const loanDates = Array.from(new Set(rows.map((r) => r.loan_date)))

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('loan_records')
    .select('id, title, loan_date, library, due_date, renewed')
    .in('library', libraries)
    .in('loan_date', loanDates)

  if (fetchError) {
    return NextResponse.json(
      { error: `重複チェックエラー: ${fetchError.message}` },
      { status: 500 }
    )
  }

  const existingByKey = new Map(
    (existing ?? []).map((e) => [`${e.library} ${e.title} ${e.loan_date}`, e])
  )

  const newRows: ParsedLoan[] = []
  const updateBackfills: {
    id: number
    updates: { due_date?: string; renewed?: boolean }
  }[] = []

  for (const r of rows) {
    const match = existingByKey.get(`${r.library} ${r.title} ${r.loan_date}`)
    if (match) {
      const updates: { due_date?: string; renewed?: boolean } = {}
      if (r.due_date && match.due_date !== r.due_date) updates.due_date = r.due_date
      if (typeof r.renewed === 'boolean' && match.renewed !== r.renewed) {
        updates.renewed = r.renewed
      }
      if (Object.keys(updates).length > 0) {
        updateBackfills.push({ id: match.id, updates })
      }
      continue
    }
    newRows.push(r)
  }
  const skipped = rows.length - newRows.length

  if (updateBackfills.length > 0) {
    const results = await Promise.all(
      updateBackfills.map(({ id, updates }) =>
        supabaseAdmin.from('loan_records').update(updates).eq('id', id)
      )
    )
    const updateError = results.find((r) => r.error)?.error
    if (updateError) {
      return NextResponse.json(
        { error: `更新エラー: ${updateError.message}` },
        { status: 500 }
      )
    }
  }

  if (newRows.length === 0) {
    return NextResponse.json({
      insertedCount: 0,
      skippedCount: skipped,
      updatedCount: updateBackfills.length,
    })
  }

  const toInsert = newRows.map((r) => ({
    title: r.title,
    author: r.author,
    publisher: r.publisher,
    loan_date: r.loan_date,
    library: r.library,
    status: r.status,
    rank: r.rank,
    pickup_library: r.pickup_library,
    pickup_deadline: r.pickup_deadline,
    due_date: r.due_date,
    renewed: r.renewed,
  }))

  // defaultToNull: false にしないと、値を渡さない列(status等)がNULLとして
  // 送信されてしまい、NOT NULL制約付きのデフォルト値(status='貸出中'等)が使われない
  const { error: insertError } = await supabaseAdmin
    .from('loan_records')
    .insert(toInsert, { defaultToNull: false })

  if (insertError) {
    return NextResponse.json(
      { error: `登録エラー: ${insertError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    insertedCount: toInsert.length,
    skippedCount: skipped,
    updatedCount: updateBackfills.length,
  })
}
