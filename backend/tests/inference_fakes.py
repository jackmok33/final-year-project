"""Shared synthetic vLLM wire fixtures; these never provide admissions assessments."""

from app.inference_config import QwenSettings

KEY = "test-key-" + "a" * 40
SETTINGS = QwenSettings("http://127.0.0.1:18000/v1", KEY)


def completion(text="Test response", **overrides):
    return {
        "id": "chatcmpl-test",
        "model": "admissions-qwen",
        "choices": [{"message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 3, "total_tokens": 13},
        **overrides,
    }
