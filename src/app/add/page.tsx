'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { parseYokohamaLending, ParsedLoan } from '@/lib/parseYokohama'
import { parseYokosukaLending } from '@/lib/parseYokosuka'
import { parseKenritsuLending } from '@/lib/parseKenritsu'
import { parseYokosukaReservation } from '@/lib/parseYokosukaReservation'
import { parseYokohamaReservation } from '@/lib/parseYokohamaReservation'
import { parseKenritsuReservation } from '@/lib/parseKenritsuReservation'

type Row = ParsedLoan & { checked: boolean }

// 図書館・貸出中/予約中のどちらの形式かもユーザーに選ばせず、
// 全図書館×貸出中/予約中の全パーサーを実行して結果を合成する。
// 各パーサーは日付の区切り文字(貸出日:2026.06.21 vs 2026/06/21)や
// 「【図書】」の有無・タブ区切りかどうかなど図書館ごとに異なる形式を
// 手がかりに、自分の担当外のテキストからは何も抽出しない設計になっている
const allParsers: ((text: string) => ParsedLoan[])[] = [
  parseYokohamaLending,
  parseYokohamaReservation,
  parseYokosukaLending,
  parseYokosukaReservation,
  parseKenritsuLending,
  parseKenritsuReservation,
]

export default function AddLoanPage() {
  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)

  function handleParse() {
    const parsed = allParsers.flatMap((fn) => fn(rawText))

    setRows(parsed.map((r) => ({ ...r, checked: true })))

    if (parsed.length === 0) {
      const blockCount = rawText.split('【図書】').length - 1
      const firstBlock = rawText.split('【図書】')[1] ?? '(見つからず)'
      setMessage(
        '判読できるデータが見つかりませんでした。OPACの「貸出中の本」または「予約中の本」一覧をそのまま貼り付けてください。'
      )
      setDebugInfo(
        `[診断情報] 「【図書】」の出現数: ${blockCount}件\n最初のブロック(先頭200文字):\n${firstBlock.slice(0, 200)}`
      )
    } else {
      setMessage(null)
      setDebugInfo(null)
    }
  }

  function toggleRow(index: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, checked: !r.checked } : r))
    )
  }

  async function handleRegister() {
    const checkedRows = rows.filter((r) => r.checked)

    if (checkedRows.length === 0) {
      setMessage('登録する行が選択されていません。')
      return
    }

    setSaving(true)
    setMessage(null)

    // 重複防止: 同じ図書館で「書名+貸出日」が既に登録済みの行はスキップする。
    // 既存レコードに返却期限日が無く、貼り付けたデータにはある場合は
    // 新規登録の代わりに返却期限日だけを補完する
    const libraries = Array.from(new Set(checkedRows.map((r) => r.library)))
    const loanDates = Array.from(new Set(checkedRows.map((r) => r.loan_date)))
    const { data: existing, error: fetchError } = await supabase
      .from('loan_records')
      .select('id, title, loan_date, library, due_date')
      .in('library', libraries)
      .in('loan_date', loanDates)

    if (fetchError) {
      setSaving(false)
      setMessage(`重複チェックエラー: ${fetchError.message}`)
      return
    }

    const existingByKey = new Map(
      (existing ?? []).map((e) => [`${e.library} ${e.title} ${e.loan_date}`, e])
    )

    const newRows: Row[] = []
    const dueDateBackfills: { id: number; due_date: string }[] = []

    for (const r of checkedRows) {
      const match = existingByKey.get(`${r.library} ${r.title} ${r.loan_date}`)
      if (match) {
        if (!match.due_date && r.due_date) {
          dueDateBackfills.push({ id: match.id, due_date: r.due_date })
        }
        continue
      }
      newRows.push(r)
    }
    const skipped = checkedRows.length - newRows.length

    if (dueDateBackfills.length > 0) {
      await Promise.all(
        dueDateBackfills.map(({ id, due_date }) =>
          supabase.from('loan_records').update({ due_date }).eq('id', id)
        )
      )
    }

    if (newRows.length === 0) {
      setSaving(false)
      setMessage(
        dueDateBackfills.length > 0
          ? `新規登録はありませんでした(${dueDateBackfills.length}件の返却期限日を補完しました)。`
          : `登録対象はすべて登録済みでした(${skipped}件重複のためスキップ)。`
      )
      return
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
    }))

    // defaultToNull: false にしないと、値を渡さない列(status等)がNULLとして
    // 送信されてしまい、NOT NULL制約付きのデフォルト値(status='貸出中'等)が使われない
    const { error } = await supabase
      .from('loan_records')
      .insert(toInsert, { defaultToNull: false })

    setSaving(false)

    if (error) {
      setMessage(`登録エラー: ${error.message}`)
    } else {
      const notes = [
        skipped > 0 ? `${skipped}件は登録済みのためスキップ` : '',
        dueDateBackfills.length > 0
          ? `${dueDateBackfills.length}件の返却期限日を補完`
          : '',
      ].filter(Boolean)
      setMessage(
        `${toInsert.length}件を登録しました${notes.length > 0 ? `(${notes.join('、')})` : ''}。`
      )
      setRows([])
      setRawText('')
    }
  }

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <Link href="/" className="text-sm text-blue-600 underline">
        ← 一覧に戻る
      </Link>

      <h1 className="text-2xl font-bold mt-2 mb-2">新規登録</h1>
      <p className="text-gray-600 mb-4 text-sm">
        OPACの「貸出中の本」または「予約中の本」一覧ページを開き、その内容をコピーして下に貼り付けてください(両方貼り付けても構いません)。
      </p>

      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="ここにOPACの貸出中の本・予約中の本一覧を貼り付け"
        className="w-full h-48 border rounded p-2 text-sm font-mono mb-3"
      />

      <button
        onClick={handleParse}
        className="bg-gray-800 text-white rounded px-4 py-1.5 mb-6"
      >
        判読する
      </button>

      {message && <p className="text-sm mb-4 text-gray-700">{message}</p>}

      {debugInfo && (
        <pre className="text-xs bg-gray-100 border rounded p-3 mb-4 whitespace-pre-wrap break-all">
          {debugInfo}
        </pre>
      )}

      {rows.length > 0 && (
        <>
          <h2 className="font-semibold mb-2">
            判読結果({rows.length}件) — 登録する行にチェック
          </h2>
          <ul className="space-y-2 mb-6">
            {rows.map((r, i) => (
              <li
                key={i}
                className="flex items-start gap-2 border-b pb-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={r.checked}
                  onChange={() => toggleRow(i)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">{r.title}</div>
                  {r.status === '予約中' ? (
                    <div className="text-gray-500">
                      {r.library} ・ 予約日: {r.loan_date} ・ 状況/順位:{' '}
                      {r.rank} ・ 受取館: {r.pickup_library}
                      {r.pickup_deadline
                        ? ` ・ 取置期限: ${r.pickup_deadline}`
                        : ''}
                    </div>
                  ) : (
                    <div className="text-gray-500">
                      {r.author} ・ {r.publisher} ・ {r.library} ・ 貸出日:{' '}
                      {r.loan_date}
                      {r.due_date ? ` ・ 返却期限: ${r.due_date}` : ''}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <button
            onClick={handleRegister}
            disabled={saving}
            className="bg-blue-700 text-white rounded px-4 py-1.5 disabled:opacity-50"
          >
            {saving ? '登録中...' : 'Supabaseに登録する'}
          </button>
        </>
      )}
    </main>
  )
}
