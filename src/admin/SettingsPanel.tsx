import { useCallback, useEffect, useState } from 'react'
import { addAdmin, listAdmins } from '../lib/api'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/util'
import { Btn, Group, TextInput } from './ui'

export function SettingsPanel({ invitationId, email, toast }: { invitationId: string; email: string; toast: (m: string, k?: 'ok' | 'error') => void }) {
  const [admins, setAdmins] = useState<{ user_id: string; email: string; created_at: string }[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [pw, setPw] = useState('')
  const load = useCallback(async () => {
    try {
      setAdmins(await listAdmins(invitationId))
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }, [invitationId, toast])
  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-[20px] font-semibold text-stone-800">설정</h1>
      <div className="mt-5 rounded-2xl border border-stone-200 bg-white">
        <Group title="관리자">
          <ul className="space-y-1.5">
            {admins.map((a) => (
              <li key={a.user_id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-[13px]">
                <span>{a.email}</span>
                {a.email === email && <span className="text-[11px] text-stone-400">나</span>}
              </li>
            ))}
          </ul>
          <p className="text-[11.5px] leading-relaxed text-stone-400">
            함께 편집할 사람은 먼저 /admin 에서 같은 방법으로 가입한 뒤, 아래에 이메일을 입력해 추가하세요.
          </p>
          <div className="flex gap-2">
            <input className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-[13px]" placeholder="partner@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <Btn
              variant="primary"
              disabled={!newEmail.includes('@')}
              onClick={async () => {
                try {
                  await addAdmin(invitationId, newEmail)
                  setNewEmail('')
                  toast('관리자를 추가했어요')
                  void load()
                } catch (e) {
                  toast(errorMessage(e), 'error')
                }
              }}
            >
              추가
            </Btn>
          </div>
        </Group>
        <Group title="내 계정">
          <p className="text-[13px] text-stone-600">{email}</p>
          <TextInput label="새 비밀번호" type="password" value={pw} onChange={setPw} hint="8자 이상" />
          <Btn
            disabled={pw.length < 8}
            onClick={async () => {
              const { error } = await supabase!.auth.updateUser({ password: pw })
              if (error) toast(errorMessage(error), 'error')
              else {
                setPw('')
                toast('비밀번호를 변경했어요')
              }
            }}
          >
            비밀번호 변경
          </Btn>
        </Group>
      </div>
    </div>
  )
}
