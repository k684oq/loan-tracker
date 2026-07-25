'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DeleteButton({ id, title }: { id: number; title: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (!window.confirm(`「${title}」を削除しますか?この操作は取り消せません。`)) {
      return
    }

    setLoading(true)
    setError(null)

    const { error } = await supabase.from('loan_records').delete().eq('id', id)

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="mt-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-xs bg-red-700 text-white rounded px-2 py-1 disabled:opacity-50"
      >
        {loading ? '削除中...' : '削除'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">エラー: {error}</p>}
    </div>
  )
}
