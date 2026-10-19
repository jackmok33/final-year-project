import { useContent } from '../../hooks/useContent'
import { ArrowForward } from '@mui/icons-material'
import { Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import type { User } from '../../domain/types'
import { ErrorNotice, Loading } from '../common'

type DemoAccount = Pick<User, 'id' | 'name' | 'active'>

export function DemoSignIn({
  accounts,
  account,
  error,
  isLoading,
  setSelected,
  login,
}: {
  accounts: DemoAccount[] | undefined
  account: DemoAccount | undefined
  error: unknown
  isLoading: boolean
  setSelected: (id: string) => void
  login: () => void
}) {
  const content = useContent('demoSignIn')
  return (
    <Stack sx={{ p: { xs: 3, sm: 4 }, pt: { xs: 1, sm: 1 } }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h2">
          {content.signIn}
        </Typography>
        <ErrorNotice error={error} />
        {isLoading ? (
          <Loading />
        ) : (
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault()
              login()
            }}
          >
            <Stack spacing={2.5}>
              <TextField
                select
                label={content.account}
                value={account?.id ?? ''}
                onChange={(e) => setSelected(e.target.value)}
              >
                {accounts
                  ?.filter((a) => a.active)
                  .map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.name}
                    </MenuItem>
                  ))}
              </TextField>
              <Button
                variant="contained"
                type="submit"
                fullWidth
                endIcon={<ArrowForward />}
                disabled={!account?.active}
              >
                {content.continue}
              </Button>
            </Stack>
          </Box>
        )}
      </Stack>
    </Stack>
  )
}
