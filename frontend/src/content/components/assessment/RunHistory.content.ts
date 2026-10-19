import type { Outcome, Workflow } from '../../../domain/types'
import { domainLabelsContent } from '../../domain/types.content'

export const runHistoryContent = {
  runHistory: 'Assessment history',
  reEvaluate: 'Re-evaluate application',
  assessmentRun: 'Assessment run',
  runOption: (number: number, criteriaVersion: string | undefined, status: Workflow) =>
    `Run ${String(number).padStart(3, '0')} · Criteria v${criteriaVersion ?? ''} · ${domainLabelsContent.workflowLabels[status]}`,
  assessmentTime: (time: string) => `${time} · Assessment`,
  gradeCorrection: (original: number | null, corrected: number) =>
    `Grade corrected: ${original ?? 'Unknown'}% → ${corrected}%`,
  correctionDetails: (reason: string, time: string) => `${reason} · ${time}`,
  tutorRecorded: (outcome: Outcome) =>
    `Tutor recorded: ${domainLabelsContent.outcomeLabels[outcome]}`,
  decisionDetails: (reason: string, time: string) => `${reason || 'Decision recorded'} · ${time}`,
  historyHint: 'Earlier runs and decisions remain available after a correction or criteria change.',
} as const
