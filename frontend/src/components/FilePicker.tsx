import { Button } from '@mui/material'
import { useRef, type ReactNode } from 'react'

export function FilePicker({
  label,
  inputLabel,
  accept,
  disabled,
  icon,
  onSelect,
}: {
  label: string
  inputLabel: string
  accept: string
  disabled?: boolean
  icon?: ReactNode
  onSelect: (file?: File) => void
}) {
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
        disabled={disabled}
        onChange={(event) => {
          onSelect(event.currentTarget.files?.[0])
          event.currentTarget.value = ''
        }}
      />
    </>
  )
}
