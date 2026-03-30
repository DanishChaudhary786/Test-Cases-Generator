"""
AI Service - business logic for test case generation using AI providers.
Adapted from unified_agent.py
"""

import json
import re
import time
from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Literal, Any, Generator

from app.core.constants import (
    DEFAULT_AI_MODELS,
    SYSTEM_PROMPT,
    REVIEW_PROMPT,
    CONTEXT_FOOTER,
    TOOL_DESCRIPTION,
    TOOL_NAME_FIELD_DESCRIPTION,
)

ProviderType = Literal["openai", "anthropic", "gemini", "deepseek"]


class AIProviderError(Exception):
    """Custom exception for AI provider errors."""
    pass


def extract_test_cases_from_response(data: Any, source: str = "response") -> List[Dict]:
    """Robustly extract test_cases from various response formats."""
    if isinstance(data, list):
        if len(data) > 0 and isinstance(data[0], dict):
            return data
        raise AIProviderError(f"Got a list from {source} but it doesn't contain test case objects")
    
    if isinstance(data, dict):
        if "test_cases" in data:
            return data["test_cases"]
        if "input" in data and isinstance(data["input"], dict):
            if "test_cases" in data["input"]:
                return data["input"]["test_cases"]
        for key in ["testCases", "cases", "tests", "results"]:
            if key in data:
                return data[key]
        
        available_keys = list(data.keys())
        raise AIProviderError(
            f"Could not find 'test_cases' in {source}. "
            f"Available keys: {available_keys}."
        )
    
    if isinstance(data, str):
        try:
            json_match = re.search(r'\[[\s\S]*\]', data)
            if json_match:
                parsed = json.loads(json_match.group())
                if isinstance(parsed, list):
                    return parsed
            json_match = re.search(r'\{[\s\S]*\}', data)
            if json_match:
                parsed = json.loads(json_match.group())
                return extract_test_cases_from_response(parsed, source)
        except json.JSONDecodeError:
            pass
        
        raise AIProviderError(
            f"Got string response from {source} but could not parse as JSON. "
            f"First 200 chars: {data[:200]}..."
        )
    
    raise AIProviderError(f"Unexpected data type from {source}: {type(data).__name__}")


def _split_jira_keys(jira_field: str) -> List[str]:
    """Split a jira field into stripped issue keys (comma-separated)."""
    if not jira_field:
        return []
    return [p.strip() for p in str(jira_field).split(",") if p.strip()]


def expand_test_cases_for_children(
    test_cases: List[Dict],
    epic_key: str,
    child_keys: List[str],
    fe_key: Optional[str] = None,
) -> List[Dict]:
    """
    Ensure each child task receives its own rows in the sheet.

    - Replaces the Epic key in ``jira`` with every selected child key.
    - Splits any test case tagged with multiple child keys into one row per key
      (so epic-level / shared tests are appended under each child for grouping).
    - If ``jira`` is missing or does not match any selected child, assigns the
      test case to every selected child so it is not dropped.
    """
    if not child_keys:
        return list(test_cases)

    child_set = set(child_keys)
    epic = (epic_key or "").strip()
    expanded: List[Dict] = []

    for tc in test_cases:
        if not isinstance(tc, dict):
            continue

        # Special handling: cross-browser/OS compatibility should only be attached
        # to the FE (frontend) task, not duplicated across every child.
        name = str(tc.get("name") or "")
        if "cross-browser and os compatibility" in name.lower():
            target = (fe_key or (child_keys[0] if child_keys else None))
            if target:
                expanded.append({**tc, "jira": target})
            continue

        raw_keys = _split_jira_keys(tc.get("jira") or tc.get("jira_id") or tc.get("ticket") or "")

        normalized: List[str] = []
        for k in raw_keys:
            if epic and k == epic:
                normalized.extend(child_keys)
            else:
                normalized.append(k)

        seen_norm = set()
        ordered_full: List[str] = []
        for k in normalized:
            if k not in seen_norm:
                seen_norm.add(k)
                ordered_full.append(k)

        ordered = [k for k in ordered_full if k in child_set]

        if not ordered:
            targets = list(child_keys)
        elif len(ordered) == 1:
            targets = ordered
        else:
            targets = ordered

        for kid in targets:
            expanded.append({**tc, "jira": kid})

    return expanded


def select_fe_child_key(issues: List[Dict], child_keys: List[str]) -> Optional[str]:
    """
    Heuristic to find the "FE task" among the selected child tasks.

    We look for FE/frontend indicators in labels and summary. If nothing matches,
    we fall back to the first provided child key.
    """
    if not child_keys:
        return None

    def score_issue(issue: Dict) -> int:
        summary = (issue.get("summary") or "").lower()
        labels = [str(l).lower() for l in (issue.get("labels") or [])]

        score = 0
        # Strong signals
        if any(l == "fe" for l in labels):
            score += 50
        if any("frontend" in l for l in labels):
            score += 40
        if any(l.startswith("fe") for l in labels):
            score += 25

        # Summary signals (common patterns)
        if "frontend" in summary:
            score += 20
        if "front end" in summary:
            score += 20
        if re.search(r"\bfe\b", summary):
            score += 15
        if "ui" in summary or "web ui" in summary:
            score += 8
        return score

    best = None
    best_score = -1
    for issue in issues:
        key = issue.get("key")
        if not key or key not in child_keys:
            continue
        s = score_issue(issue)
        if s > best_score:
            best_score = s
            best = key

    return best or (child_keys[0] if child_keys else None)


def validate_test_cases(test_cases: List[Dict]) -> List[Dict]:
    """Validate and clean test cases, ensuring required fields exist."""
    validated = []
    for i, tc in enumerate(test_cases):
        if not isinstance(tc, dict):
            continue
        
        name = tc.get("name") or tc.get("title") or f"Test Case {i+1}"
        
        if not name.strip().startswith("Verify"):
            name = name.strip()
            prefixes_to_remove = ["Test ", "Check ", "Validate ", "Ensure ", "Confirm "]
            for prefix in prefixes_to_remove:
                if name.startswith(prefix):
                    name = name[len(prefix):]
                    break
            name = f"Verify {name}"
        
        validated_tc = {
            "name": name,
            "description": tc.get("description") or tc.get("steps") or [],
            "jira": tc.get("jira") or tc.get("jira_id") or tc.get("ticket") or "",
            "labels": tc.get("labels") or "",
        }
        
        if isinstance(validated_tc["description"], str):
            validated_tc["description"] = [validated_tc["description"]]
        
        validated.append(validated_tc)
    
    return validated


class BaseProvider(ABC):
    """Abstract base class for AI providers."""
    
    @abstractmethod
    def generate_test_cases(self, context: str) -> List[Dict]:
        """Generate test cases from the given context."""
        pass


class AnthropicProvider(BaseProvider):
    """Claude AI provider using tool-use API."""
    
    MAX_RETRIES = 3
    RETRY_DELAY = 2
    
    def __init__(self, api_key: str, model: str = None):
        import anthropic
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model or DEFAULT_AI_MODELS["anthropic"]
        self.max_tokens = 8192
    
    def generate_test_cases(self, context: str) -> List[Dict]:
        last_error = None
        
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                test_cases = self._generate_with_tool(context)
                validated = validate_test_cases(test_cases)
                
                if not validated:
                    raise AIProviderError("AI returned test cases but none were valid")
                
                return validated
                
            except AIProviderError as e:
                last_error = e
                if attempt < self.MAX_RETRIES:
                    time.sleep(self.RETRY_DELAY)
            except Exception as e:
                last_error = AIProviderError(f"Unexpected error: {type(e).__name__}: {str(e)}")
                if attempt < self.MAX_RETRIES:
                    time.sleep(self.RETRY_DELAY)
        
        raise AIProviderError(f"Failed after {self.MAX_RETRIES} attempts. Last error: {last_error}")
    
    def _generate_via_plain_json(self, context: str) -> List[Dict]:
        """
        Fallback when the installed anthropic SDK is too old for tool_use (no ``tools`` kwarg).
        Asks for the same structured payload as plain JSON in the assistant text.
        """
        footer = (
            "Respond with ONLY a single JSON object (no markdown code fences). "
            'Keys: "test_cases" (array of { "name", "description", "jira", "labels" } '
            'where description is an array of strings) and "reasoning" (string).'
        )
        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"{context}\n\n{footer}"}],
        )
        text_response = ""
        for block in response.content:
            if hasattr(block, "type") and block.type == "text":
                text_response += getattr(block, "text", "") or ""
        return extract_test_cases_from_response(text_response, "Claude JSON response")
    
    def _generate_with_tool(self, context: str) -> List[Dict]:
        tool = self._get_tool_schema()
        
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=SYSTEM_PROMPT,
                tools=[tool],
                tool_choice={"type": "any"},
                messages=[{"role": "user", "content": context}],
            )
        except TypeError as e:
            err = str(e).lower()
            if "tools" in err or "tool_choice" in err or "unexpected keyword" in err:
                return self._generate_via_plain_json(context)
            raise
        
        tool_use_block = None
        text_response = ""
        
        for block in response.content:
            if hasattr(block, 'type'):
                if block.type == "tool_use" and block.name == "generate_test_cases":
                    tool_use_block = block
                elif block.type == "text":
                    text_response += block.text
        
        if not tool_use_block:
            if text_response:
                try:
                    return extract_test_cases_from_response(text_response, "text response")
                except AIProviderError:
                    pass
            
            raise AIProviderError("Claude did not generate test cases in the expected format.")
        
        return extract_test_cases_from_response(tool_use_block.input, "Claude tool response")
    
    def _get_tool_schema(self) -> Dict:
        return {
            "name": "generate_test_cases",
            "description": TOOL_DESCRIPTION,
            "input_schema": {
                "type": "object",
                "properties": {
                    "test_cases": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string", "description": TOOL_NAME_FIELD_DESCRIPTION},
                                "description": {"type": "array", "items": {"type": "string"}},
                                "jira": {"type": "string"},
                                "labels": {"type": "string"},
                            },
                            "required": ["name", "description", "jira", "labels"]
                        }
                    },
                    "reasoning": {"type": "string"}
                },
                "required": ["test_cases", "reasoning"]
            }
        }


class OpenAIProvider(BaseProvider):
    """OpenAI GPT provider using function calling."""
    
    MAX_RETRIES = 3
    RETRY_DELAY = 2
    
    def __init__(self, api_key: str, model: str = None):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key)
        self.model = model or DEFAULT_AI_MODELS["openai"]
    
    def generate_test_cases(self, context: str) -> List[Dict]:
        last_error = None
        
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                test_cases = self._generate_with_tool(context)
                validated = validate_test_cases(test_cases)
                
                if not validated:
                    raise AIProviderError("OpenAI returned test cases but none were valid")
                
                return validated
                
            except AIProviderError as e:
                last_error = e
                if attempt < self.MAX_RETRIES:
                    time.sleep(self.RETRY_DELAY)
            except Exception as e:
                last_error = AIProviderError(f"Unexpected error: {type(e).__name__}: {str(e)}")
                if attempt < self.MAX_RETRIES:
                    time.sleep(self.RETRY_DELAY)
        
        raise AIProviderError(f"Failed after {self.MAX_RETRIES} attempts. Last error: {last_error}")
    
    def _generate_with_tool(self, context: str) -> List[Dict]:
        tools = [self._get_tool_schema()]
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": context}
            ],
            tools=tools,
            tool_choice={"type": "function", "function": {"name": "generate_test_cases"}}
        )
        
        if not response.choices[0].message.tool_calls:
            content = response.choices[0].message.content or ""
            raise AIProviderError(f"OpenAI did not use the tool. Response: {content[:300]}...")
        
        tool_call = response.choices[0].message.tool_calls[0]
        parsed = json.loads(tool_call.function.arguments)
        return extract_test_cases_from_response(parsed, "OpenAI tool response")
    
    def _get_tool_schema(self) -> Dict:
        return {
            "type": "function",
            "function": {
                "name": "generate_test_cases",
                "description": TOOL_DESCRIPTION,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "test_cases": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string", "description": TOOL_NAME_FIELD_DESCRIPTION},
                                    "description": {"type": "array", "items": {"type": "string"}},
                                    "jira": {"type": "string"},
                                    "labels": {"type": "string"},
                                },
                                "required": ["name", "description", "jira", "labels"]
                            }
                        },
                        "reasoning": {"type": "string"}
                    },
                    "required": ["test_cases", "reasoning"]
                }
            }
        }


class DeepSeekProvider(BaseProvider):
    """DeepSeek provider using OpenAI-compatible API."""
    
    MAX_RETRIES = 3
    RETRY_DELAY = 2
    DEEPSEEK_BASE_URL = "https://api.deepseek.com"
    
    def __init__(self, api_key: str, model: str = None):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key, base_url=self.DEEPSEEK_BASE_URL)
        self.model = model or DEFAULT_AI_MODELS["deepseek"]
    
    def generate_test_cases(self, context: str) -> List[Dict]:
        last_error = None
        
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                test_cases = self._generate_with_tool(context)
                validated = validate_test_cases(test_cases)
                
                if not validated:
                    raise AIProviderError("DeepSeek returned test cases but none were valid")
                
                return validated
                
            except AIProviderError as e:
                last_error = e
                if attempt < self.MAX_RETRIES:
                    time.sleep(self.RETRY_DELAY)
            except Exception as e:
                last_error = AIProviderError(f"Unexpected error: {type(e).__name__}: {str(e)}")
                if attempt < self.MAX_RETRIES:
                    time.sleep(self.RETRY_DELAY)
        
        raise AIProviderError(f"Failed after {self.MAX_RETRIES} attempts. Last error: {last_error}")
    
    def _generate_with_tool(self, context: str) -> List[Dict]:
        tools = [self._get_tool_schema()]
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": context}
            ],
            tools=tools,
            tool_choice={"type": "function", "function": {"name": "generate_test_cases"}}
        )
        
        if not response.choices[0].message.tool_calls:
            content = response.choices[0].message.content or ""
            raise AIProviderError(f"DeepSeek did not use the tool. Response: {content[:300]}...")
        
        tool_call = response.choices[0].message.tool_calls[0]
        parsed = json.loads(tool_call.function.arguments)
        return extract_test_cases_from_response(parsed, "DeepSeek tool response")
    
    def _get_tool_schema(self) -> Dict:
        return {
            "type": "function",
            "function": {
                "name": "generate_test_cases",
                "description": TOOL_DESCRIPTION,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "test_cases": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string", "description": TOOL_NAME_FIELD_DESCRIPTION},
                                    "description": {"type": "array", "items": {"type": "string"}},
                                    "jira": {"type": "string"},
                                    "labels": {"type": "string"},
                                },
                                "required": ["name", "description", "jira", "labels"]
                            }
                        },
                        "reasoning": {"type": "string"}
                    },
                    "required": ["test_cases", "reasoning"]
                }
            }
        }


class GeminiProvider(BaseProvider):
    """Google Gemini provider using function calling."""
    
    def __init__(self, api_key: str, model: str = None):
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(
            model_name=model or DEFAULT_AI_MODELS["gemini"],
            system_instruction=SYSTEM_PROMPT,
            tools=[self._get_tool_schema()]
        )
    
    def generate_test_cases(self, context: str) -> List[Dict]:
        chat = self.model.start_chat()
        response = chat.send_message(context)
        
        initial_cases = []
        for part in response.parts:
            if hasattr(part, 'function_call') and part.function_call.name == "generate_test_cases":
                args = dict(part.function_call.args)
                initial_cases = list(args.get("test_cases", []))
                break
        
        if not initial_cases:
            return self._parse_from_text(response.text)
        
        response2 = chat.send_message(REVIEW_PROMPT)
        
        for part in response2.parts:
            if hasattr(part, 'function_call') and part.function_call.name == "generate_test_cases":
                args = dict(part.function_call.args)
                return validate_test_cases(list(args.get("test_cases", initial_cases)))
        
        return validate_test_cases(initial_cases)
    
    def _get_tool_schema(self):
        return {
            "function_declarations": [{
                "name": "generate_test_cases",
                "description": TOOL_DESCRIPTION,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "test_cases": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string", "description": TOOL_NAME_FIELD_DESCRIPTION},
                                    "description": {"type": "array", "items": {"type": "string"}},
                                    "jira": {"type": "string"},
                                    "labels": {"type": "string"},
                                },
                                "required": ["name", "description", "jira", "labels"]
                            }
                        },
                        "reasoning": {"type": "string"}
                    },
                    "required": ["test_cases", "reasoning"]
                }
            }]
        }
    
    def _parse_from_text(self, text: str) -> List[Dict]:
        try:
            json_match = re.search(r'\[[\s\S]*\]', text)
            if json_match:
                return validate_test_cases(json.loads(json_match.group()))
        except:
            pass
        return []


class AIService:
    """Unified AI Service for test case generation."""
    
    PROVIDERS = {
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
        "gemini": GeminiProvider,
        "deepseek": DeepSeekProvider,
    }
    
    def __init__(self, provider: ProviderType, api_key: str, model: str = None):
        if provider not in self.PROVIDERS:
            raise ValueError(f"Unknown provider: {provider}")
        
        provider_class = self.PROVIDERS[provider]
        self.provider = provider_class(api_key=api_key, model=model) if model else provider_class(api_key=api_key)
        self.provider_name = provider
    
    def generate_test_cases(
        self,
        epic: Dict,
        issues: List[Dict],
        progress_callback: Optional[callable] = None,
    ) -> List[Dict]:
        """Generate test cases from Epic and issues."""
        if progress_callback:
            progress_callback(f"Building context from {len(issues)} issues...")
        
        context = self._build_context(epic, issues)
        
        if progress_callback:
            progress_callback(f"Generating test cases with {self.provider_name.upper()}...")
        
        test_cases = self.provider.generate_test_cases(context)
        
        child_keys = [i["key"] for i in issues if i.get("key")]
        fe_key = select_fe_child_key(issues, child_keys)
        test_cases = expand_test_cases_for_children(
            test_cases,
            epic_key=epic.get("key", ""),
            child_keys=child_keys,
            fe_key=fe_key,
        )
        
        if progress_callback:
            progress_callback(f"Generated {len(test_cases)} test cases (expanded per child task)")
        
        return test_cases
    
    def _build_context(self, epic: Dict, issues: List[Dict]) -> str:
        child_key_list = [i["key"] for i in issues if i.get("key")]
        valid_jira_hint = (
            ", ".join(child_key_list) if child_key_list else "(none)"
        )
        lines = [
            f"EPIC: {epic['key']} — {epic['summary']}",
            f"Status: {epic.get('status', 'N/A')}",
            f"Labels: {', '.join(epic.get('labels', [])) or 'none'}",
            f"Description:\n{epic.get('description', 'No description provided.')}",
            "",
            "ALLOWED \"jira\" KEYS (child tasks only — never use the Epic key in \"jira\"):",
            valid_jira_hint,
            "",
            f"LINKED ISSUES ({len(issues)} total):",
            "─" * 50,
        ]
        
        for issue in issues:
            lines.append(f"\n{issue['key']} [{issue['type']}] — {issue['summary']}")
            lines.append(f"Status: {issue['status']} | Priority: {issue.get('priority', 'N/A')}")
            if issue.get("labels"):
                lines.append(f"Labels: {', '.join(issue['labels'])}")
            if issue.get("description"):
                lines.append(f"Description:\n{issue['description']}")
            lines.append("─" * 30)
        
        lines.append(CONTEXT_FOOTER)
        
        return "\n".join(lines)
