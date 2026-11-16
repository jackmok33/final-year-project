"""Shared synthetic vLLM wire fixtures; these never provide admissions assessments."""

from app.inference_config import OPENAI_BASE_URL, OPENAI_DEFAULT_MODEL, InferenceSettings

KEY = "test-key-" + "a" * 40
SETTINGS = InferenceSettings("http://127.0.0.1:18000/v1", KEY)
OPENAI_KEY = "sk-test-" + "b" * 100
OPENAI_SETTINGS = InferenceSettings(
    OPENAI_BASE_URL, OPENAI_KEY, model=OPENAI_DEFAULT_MODEL, provider="openai"
)


def completion(text="Test response", **overrides):
    return {
        "id": "chatcmpl-test",
        "model": "admissions-qwen",
        "choices": [{"message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 3, "total_tokens": 13},
        **overrides,
    }
