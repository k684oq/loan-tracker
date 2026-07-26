'use client'

import { useState } from 'react'
import Link from 'next/link'
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

    // 重複チェック・返却期限日/延長可否の補完・登録は全てサーバー側(/api/records)で行う
    const res = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: checkedRows.map(({ checked: _checked, ...r }) => r),
      }),
    })

    setSaving(false)

    const body = await res.json().catch(() => null)

    if (!res.ok) {
      setMessage(`登録エラー: ${body?.error ?? '不明なエラー'}`)
      return
    }

    const { insertedCount, skippedCount, updatedCount } = body as {
      insertedCount: number
      skippedCount: number
      updatedCount: number
    }

    if (insertedCount === 0) {
      setMessage(
        updatedCount > 0
          ? `新規登録はありませんでした(${updatedCount}件の返却期限日/延長可否を更新しました)。`
          : `登録対象はすべて登録済みでした(${skippedCount}件重複のためスキップ)。`
      )
      return
    }

    const notes = [
      skippedCount > 0 ? `${skippedCount}件は登録済みのためスキップ` : '',
      updatedCount > 0 ? `${updatedCount}件の返却期限日/延長可否を更新` : '',
    ].filter(Boolean)
    setMessage(
      `${insertedCount}件を登録しました${notes.length > 0 ? `(${notes.join('、')})` : ''}。`
    )
    setRows([])
    setRawText('')
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
                      {typeof r.renewed === 'boolean'
                        ? ` ・ ${r.renewed ? '延長可能' : '延長不可'}`
                        : ''}
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
