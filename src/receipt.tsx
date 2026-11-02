import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface ReceiptLine {
  label: string
  value: string
  tone?: 'up' | 'down' | 'muted'
}

export interface ReceiptContent {
  title: string
  lines: ReceiptLine[]
  notes: string[]
}

const Ctx = createContext<{ content: ReceiptContent | null; set: (c: ReceiptContent | null) => void } | null>(null)

export function ReceiptProvider({ children }: { children: ReactNode }) {
  const [content, set] = useState<ReceiptContent | null>(null)
  return <Ctx.Provider value={{ content, set }}>{children}</Ctx.Provider>
}

export function useReceiptContent() {
  return useContext(Ctx)!.content
}

/** Modules call this to send their calculated notes to the receipt printer. */
export function usePrint(content: ReceiptContent | null, key: string) {
  const ctx = useContext(Ctx)!
  useEffect(() => {
    ctx.set(content)
    // key captures every input that changes the printed text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
