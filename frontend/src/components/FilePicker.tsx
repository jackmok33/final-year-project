import { Button } from '@mui/material'
import { useRef, type ReactNode } from 'react'

export function FilePicker({
  label,
  inputLabel,
  accept,
  disabled,
  icon,
  onSelect,
  onSelectMany,
}: {
  label: string
  inputLabel: string
  accept: string
  disabled?: boolean
  icon?: ReactNode
} & (
  | { onSelect: (file?: File) => void; onSelectMany?: never }
  | { onSelect?: never; onSelectMany: (files: File[]) => void }
)) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button
        type="button"
        variant="outlined"
        disabled={disabled}
        startIcon={icon}
        onClick={() => input.current?.click()}
      >
        {label}
      </Button>
      <input
        ref={input}
        type="file"
        hidden
        aria-label={inputLabel}
        accept={accept}
        multiple={!!onSelectMany}
        disabled={disabled}
        onChange={(event) => {
          if (onSelectMany) onSelectMany(Array.from(event.currentTarget.files ?? []))
          else onSelect(event.currentTarget.files?.[0])
          event.currentTarget.value = ''
        }}
      />
    </>
  )
}
