import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// RecordListの「選択した本を返却した」から呼ばれる
export async function POST(request: Request) {
  const { ids } = (await request.json()) as { ids: number[] }

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(Number.isInteger)) {
    return NextResponse.json({ error: '不正なIDです' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabaseAdmin
    .from('loan_records')
    .update({ return_date: today })
    .in('id', ids)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
