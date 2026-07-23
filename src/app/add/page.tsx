'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { parseYokohamaLending, ParsedLoan } from '@/lib/parseYokohama'
import { parseYokosukaLending } from '@/lib/parseYokosuka'
import { parseKenritsuLending } from '@/lib/parseKenritsu'
import { parseYokosukaReservation } from '@/lib/parseYokosukaReservation'

type Row = ParsedLoan & { checked: boolean }
type LibraryOption = 'yokohama' | 'yokosuka' | 'kenritsu'
type KindOption = 'loan' | 'reservation'

export default function AddLoanPage() {
  const [libraryOption, setLibraryOption] = useState<LibraryOption>('yokohama')
  const [kindOption, setKindOption] = useState<KindOption>('loan')
  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)

  function handleParse() {
    const parsed =
      kindOption === 'reservation' && libraryOption === 'yokosuka'
        ? parseYokosukaReservation(rawText)
        : libraryOption === 'yokohama'
          ? parseYokohamaLending(rawText)
          : libraryOption === 'yokosuka'
            ? parseYokosukaLending(rawText)
            : parseKenritsuLending(rawText)

    setRows(parsed.map((r) => ({ ...r, checked: true })))

    if (parsed.length === 0) {
      const blockCount = rawText.split('【図書】').length - 1
      const firstBlock = rawText.split('【図書】')[1] ?? '(見つからず)'
      setMessage(
        '判読できる貸出データが見つかりませんでした。選択した図書館のOPAC「貸出中の本」一覧をそのまま貼り付けてください。'
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
    const toInsert = rows
      .filter((r) => r.checked)
      .map((r) => ({
        title: r.title,
        author: r.author,
        publisher: r.publisher,
        loan_date: r.loan_date,
        library: r.library,
        status: r.status,
        rank: r.rank,
        pickup_library: r.pickup_library,
        pickup_deadline: r.pickup_deadline,
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
      <p className="text-gray-600 mb-4 text-sm">
        OPACの「貸出中の本」一覧ページを開き、その内容をコピーして下に貼り付けてください。
      </p>

      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">図書館</label>
        <select
          value={libraryOption}
          onChange={(e) => {
            const value = e.target.value as LibraryOption
            setLibraryOption(value)
            if (value !== 'yokosuka') setKindOption('loan')
          }}
          className="border rounded px-2 py-1"
        >
          <option value="yokohama">横浜市立図書館</option>
          <option value="yokosuka">横須賀図書館</option>
          <option value="kenritsu">神奈川県立図書館</option>
        </select>
      </div>

      {libraryOption === 'yokosuka' && (
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">種別</label>
          <select
            value={kindOption}
            onChange={(e) => setKindOption(e.target.value as KindOption)}
            className="border rounded px-2 py-1"
          >
            <option value="loan">貸出中の本</option>
            <option value="reservation">予約中の本</option>
          </select>
        </div>
      )}

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
