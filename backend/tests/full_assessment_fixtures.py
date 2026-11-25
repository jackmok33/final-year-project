"""Synthetic PDF set and fake wire responses for the complete workflow."""

import json
from textwrap import wrap

import httpx

from app.assessments.shared.contracts import CourseCriteria
from app.assessments.shared.specialist import RUBRICS
from tests.cv_fixtures import cv_pdf
from tests.english_test_fixtures import RESULT, english_pdf
from tests.inference_fakes import completion

QUOTES = {
    "transcript": "BSc Computer Science awarded. Overall average: 74 percent.",
    "cv": "Designed and tested a survey analysis dashboard for a student project.",
    "statement": "I want to study statistical modelling after investigating survey bias.",
    "reference": "I supervised the project and observed careful testing of the survey analysis.",
    "application_form": "Qualification: BSc Computer Science. Overall average: 74 percent.",
}
DOCUMENTS = {key: cv_pdf((tuple(wrap(quote, width=55)),)) for key, quote in QUOTES.items()}
DOCUMENTS["english_test"] = english_pdf()
CRITERIA = CourseCriteria(
    id="rubric-synthetic",
    version="1.0",
    name="Synthetic MSc",
    weights={"academic": 40, "cv": 25, "statement": 25, "references": 10},
    reject_below=60,
    offer_from=80,
    margin=3,
    mandatory_rule="Relevant undergraduate qualification",
)


def fake_response(request):
    body = json.loads(request.content)
    messages = body["messages"]
    user = messages[-1]["content"]
    if isinstance(user, list):
        text = user[0]["text"]
        if text.startswith("Page 1 text:"):
            payload = RESULT
        else:
            payload = {"quotes": [quote for quote in QUOTES.values() if quote in text]}
    elif user.startswith("Course context and rubric:"):
        context, sources = user.split("\nSource material:\n", 1)
        rubric = json.loads(context.split("\n", 1)[1])["criteria"]
        evidence = json.loads(sources)["evidence"]
        payload = {
            "judgements": [
                {
                    "criterion": criterion,
                    "level": 2,
                    "evidence": [evidence[0]["id"]],
                    "reason": "The source describes a specific activity and relevant context.",
                }
                for criterion in rubric
            ]
        }
        if rubric == RUBRICS["academic"]:
            payload.update(academic_requirement="met", extracted_grade=74.0)
    else:
        findings = json.loads(user.split("\n", 1)[1])
        payload = {
            "summary": (
                "The sources show relevant preparation, project work and a stated learning goal. "
                "The referee describes direct observation of the work."
            ),
            "evidence": [
                section["citations"][0]["id"]
                for section in findings.values()
                if section["citations"]
            ],
        }
    return httpx.Response(200, json=completion(json.dumps(payload)))
