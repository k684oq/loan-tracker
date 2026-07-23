'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { parseYokohamaLending, ParsedLoan } from '@/lib/parseYokohama'

type Row = ParsedLoan & { checked: boolean }

export default function AddLoanPage() {
  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function handleParse() {
    const parsed = parseYokohamaLending(rawText)
    setRows(parsed.map((r) => ({ ...r, checked: true })))
    setMessage(
      parsed.length === 0
        ? '判読できる貸出データが見つかりませんでした。横浜市立図書館の「貸出中の本」一覧をそのまま貼り付けてください。'
        : null
    )
  }

  function toggleRow(index: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, checked: !r.checked } : r))
    )
  }

  async function handleRegister() {
    const toInsert = rows
      .filter((r) => r.checked)
      .map((r) => ({
        title: r.title,
        author: r.author,
        publisher: r.publisher,
        loan_date: r.loan_date,
        library: '横浜市立図書館',
      }))

    if (toInsert.length === 0) {
      setMessage('登録する行が選択されていません。')
      return
    }

    setSaving(true)
    setMessage(null)

    const { error } = await supabase.from('loan_records').insert(toInsert)

    setSaving(false)

    if (error) {
      setMessage(`登録エラー: ${error.message}`)
    } else {
      setMessage(`${toInsert.length}件を登録しました。`)
      setRows([])
      setRawText('')
    }
  }

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <Link href="/" className="text-sm text-blue-600 underline">
        ← 一覧に戻る
      </Link>

      <h1 className="text-2xl font-bold mt-2 mb-2">新規貸出を追加</h1>
      <p className="text-gray-600 mb-6 text-sm">
        横浜市立図書館OPACの「貸出中の本」一覧ページを開き、その内容をコピーして下に貼り付けてください。
      </p>

      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="ここにOPACの貸出中一覧を貼り付け"
        className="w-full h-48 border rounded p-2 text-sm font-mono mb-3"
      />

      <button
        onClick={handleParse}
        className="bg-gray-800 text-white rounded px-4 py-1.5 mb-6"
      >
        判読する
      </button>

      {message && <p className="text-sm mb-4 text-gray-700">{message}</p>}

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
                  <div className="text-gray-500">
                    {r.author} ・ {r.publisher} ・ 貸出日: {r.loan_date}
                  </div>
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
