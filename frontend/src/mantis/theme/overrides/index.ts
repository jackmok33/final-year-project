import PaginationItem from './PaginationItem'
import Tabs from './Tabs'
import Tab from './Tab'
import Pagination from './Pagination'
import type { Theme } from '@mui/material/styles'
import Alert from './Alert'
import AlertTitle from './AlertTitle'
import Chip from './Chip'
import Dialog from './Dialog'
import DialogTitle from './DialogTitle'
import DialogContentText from './DialogContentText'
import Drawer from './Drawer'
import IconButton from './IconButton'
import Typography from './Typography'
import Link from './Link'
import FormHelperText from './FormHelperText'
import ListItemButton from './ListItemButton'
import ListItemIcon from './ListItemIcon'
import Popover from './Popover'
import Radio from './Radio'
import Checkbox from './Checkbox'
import Switch from './Switch'
import Accordion from './Accordion'
import AccordionSummary from './AccordionSummary'
import AccordionDetails from './AccordionDetails'
import LinearProgress from './LinearProgress'
import TableBody from './TableBody'
import TableRow from './TableRow'
import TableFooter from './TableFooter'
import Tooltip from './Tooltip'
import Button from './Button'
import ButtonBase from './ButtonBase'
import CardContent from './CardContent'
import InputBase from './InputBase'
import InputLabel from './InputLabel'
import OutlinedInput from './OutlinedInput'
import TableCell from './TableCell'
import TableContainer from './TableContainer'
import TableHead from './TableHead'

// Mantis overrides for every styled control used by the admissions workspace.
export default function componentsOverride(theme: Theme): NonNullable<Theme['components']> {
  return {
    ...Tabs(),
    ...Tab(theme),
    ...Pagination(),
    ...PaginationItem(theme),
    ...Tooltip(theme),
    ...TableFooter(theme),
    ...TableRow(),
    ...TableBody(theme),
    ...LinearProgress(),
    ...AccordionDetails(theme),
    ...AccordionSummary(theme),
    ...Accordion(theme),
    ...Switch(theme),
    ...Checkbox(theme),
    ...Radio(theme),
    ...Popover(theme),
    ...ListItemIcon(theme),
    ...ListItemButton(theme),
    ...FormHelperText(),
    ...Link(),
    ...Typography(),
    ...IconButton(theme),
    ...Drawer(),
    ...DialogContentText(theme),
    ...DialogTitle(),
    ...Dialog(theme),
    ...Chip(theme),
    ...AlertTitle(),
    ...Alert(theme),
    ...Button(theme),
    ...ButtonBase(),
    ...CardContent(),
    ...InputBase(),
    ...InputLabel(theme),
    ...OutlinedInput(theme),
    ...TableCell(theme),
    ...TableContainer(),
    ...TableHead(theme),
  }
}
