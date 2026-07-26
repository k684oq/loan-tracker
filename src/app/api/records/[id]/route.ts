import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

type Updates = {
  return_date?: string
  status?: string
  loan_date?: string
}

// MarkAsReturnedButton(返却した)・MarkAsBorrowedButton(借りた)から呼ばれる
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const recordId = Number(id)
  if (!Number.isInteger(recordId)) {
    return NextResponse.json({ error: '不正なIDです' }, { status: 400 })
  }

  const body = (await request.json()) as Updates
  const updates: Updates = {}
  if (typeof body.return_date === 'string') updates.return_date = body.return_date
  if (typeof body.status === 'string') updates.status = body.status
  if (typeof body.loan_date === 'string') updates.loan_date = body.loan_date

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '更新内容がありません' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('loan_records')
    .update(updates)
    .eq('id', recordId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DeleteButtonから呼ばれる
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const recordId = Number(id)
  if (!Number.isInteger(recordId)) {
    return NextResponse.json({ error: '不正なIDです' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('loan_records')
    .delete()
    .eq('id', recordId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
