import { isAssessmentReady, type Application, type AssessmentRun } from '../domain/types'

/** Synthetic case metadata only; uploads never receive generated applicant facts. */
const profiles: Record<string, { name: string; studentId: string; university: string }> = {
  'APP-2026-0142': {
    name: 'Carson Darrin',
    studentId: '24738849',
    university: 'Synthetic University',
  },
  'APP-2026-0143': {
    name: 'Ashy Handgun',
    studentId: '39485584',
    university: 'Synthetic University',
  },
  'APP-2026-0144': { name: 'Larry Doe', studentId: '34829949', university: 'Synthetic University' },
  'APP-2026-0145': {
    name: 'Carson Darin',
    studentId: '57483305',
    university: 'Synthetic University',
  },
  'APP-2026-0146': {
    name: 'Sara Soudan',
    studentId: '44859938',
    university: 'Synthetic University',
  },
}
export function applicantProfile(application: Application) {
  return (
    (application.fixture && profiles[application.id]) || {
      name: application.candidate,
      studentId: application.candidate,
      university: '',
    }
  )
}

export interface EvidenceGroup {
  key: 'english' | 'education' | 'references' | 'transcript' | 'publications' | 'projects' | 'work'
  entries: string[][]
}

/** Presentation fixtures for the synthetic review; not extraction or an HTTP response. */
export function applicantEvidence(application: Application, run: AssessmentRun): EvidenceGroup[] {
  if (!application.fixture || !profiles[application.id] || !isAssessmentReady(run)) return []
  const grade = run.extractedGrade
  return [
    {
      key: 'english',
      entries: [['Level: Advanced', 'Test: IELTS Academic', 'Overall score: 7.5 / 9.0']],
    },
    {
      key: 'education',
      entries: [
        [
          'Synthetic University',
          'BSc (Hons) Computer Science',
          'Field: Computer Science and Mathematics',
          ...(grade === null ? [] : [`Overall extracted mark: ${grade}%`]),
        ],
      ],
    },
    {
      key: 'references',
      entries: [
        [
          'Dr Emma Collins · Dissertation supervisor',
          'Strongly recommended · Assessment score: 90/100',
        ],
        ['Dr Daniel Wong · Machine Learning lecturer', 'Recommended · Assessment score: 82/100'],
      ],
    },
    {
      key: 'transcript',
      entries: [
        [
          'Machine Learning: 78%',
          'Algorithms: 76%',
          'Database Systems: 72%',
          'Final-year project: 79%',
        ],
      ],
    },
    {
      key: 'publications',
      entries: [
        [
          'Graph-Based Models for Urban Traffic Prediction',
          'International Conference on Applied Data Science (illustrative)',
          '2026 · Second author of three',
        ],
      ],
    },
    {
      key: 'projects',
      entries: [
        [
          'Predicting Hospital Readmissions',
          'Individual dissertation · 2025–2026',
          'Statistical modelling and classification',
        ],
        [
          'Customer Churn Prediction',
          'Group project · 2025',
          'Machine learning and feature engineering',
        ],
      ],
    },
    {
      key: 'work',
      entries: [
        ['Vertex Analytics', 'Data Science Intern · 2025'],
        ['Meridian Software', 'Software Engineering Intern · 2024'],
      ],
    },
  ]
}
