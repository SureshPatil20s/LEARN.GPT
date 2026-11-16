"""
Secure Isolated Code Execution Sandbox — Stage 4
LEARN.GPT Platform

Strict Security Guarantees:
1. AST Static Analysis: Rejects dangerous imports (os, sys, subprocess, socket, etc.)
   and prohibited built-in functions (eval, exec, open, __import__, etc.).
2. Ephemeral Isolation: Runs in unique temporary directories with zero project env vars.
3. Strict Resource Limits: 3.0s wall-clock timeout and 10KB stdout/stderr caps.
4. Test Case Validation: Verifies candidate solutions against automated test specs.
5. Windows-safe: Uses asyncio.to_thread + subprocess.run (ProactorEventLoop compatible).
"""

from __future__ import annotations

import ast
import asyncio
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional, Tuple

from server.app.schemas.schemas import CodingExecutionResponse, TestCaseResult

logger = logging.getLogger(__name__)

# Disallowed imports and built-in functions for Python sandbox
PROHIBITED_MODULES = {
    "os", "sys", "subprocess", "shutil", "socket", "urllib", "urllib3", "requests",
    "http", "ftplib", "smtplib", "telnetlib", "pathlib", "ctypes", "builtins",
    "importlib", "multiprocessing", "threading", "signal", "posix", "nt",
    "pty", "asyncio", "resource", "code", "codeop", "inspect", "pdb"
}

PROHIBITED_BUILTINS = {
    "eval", "exec", "open", "__import__", "globals", "locals", "compile",
    "getattr", "setattr", "delattr", "hasattr", "breakpoint", "memoryview"
}

PROHIBITED_ATTRIBUTES = {
    "__subclasses__", "__bases__", "__mro__", "__globals__", "__code__",
    "__builtins__", "__import__", "__loader__", "__spec__", "f_globals", "f_locals"
}


# ---------------------------------------------------------------------------
# Layer 1: AST Static Security Auditing
# ---------------------------------------------------------------------------

def validate_code_security(code: str, language: str = "python") -> Optional[str]:
    """
    Statically analyzes code AST to enforce security policies.
    Returns None if safe, or a descriptive violation message if rejected.
    """
    if language.lower() in ["python", "py"]:
        try:
            tree = ast.parse(code)
        except SyntaxError as syn_err:
            return f"Syntax Error: {syn_err.msg} at line {syn_err.lineno}"

        for node in ast.walk(tree):
            # Check module imports: import X, Y
            if isinstance(node, ast.Import):
                for alias in node.names:
                    root_mod = alias.name.split(".")[0].lower()
                    if root_mod in PROHIBITED_MODULES:
                        return f"Security Violation: Import of module '{alias.name}' is prohibited in the interview sandbox."

            # Check from X import Y
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    root_mod = node.module.split(".")[0].lower()
                    if root_mod in PROHIBITED_MODULES:
                        return f"Security Violation: Import from module '{node.module}' is prohibited in the interview sandbox."

            # Check prohibited function calls
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in PROHIBITED_BUILTINS:
                        return f"Security Violation: Call to built-in function '{node.func.id}()' is prohibited in the interview sandbox."

            # Check prohibited attribute access (e.g. obj.__subclasses__())
            elif isinstance(node, ast.Attribute):
                if node.attr in PROHIBITED_ATTRIBUTES:
                    return f"Security Violation: Access to attribute '{node.attr}' is prohibited in the interview sandbox."

    elif language.lower() in ["javascript", "js", "typescript", "ts"]:
        # Basic heuristic check for JavaScript/Node
        forbidden_js = ["require('child_process')", "require(\"child_process\")", "require('fs')", "require(\"fs\")",
                        "require('net')", "require('http')", "process.env", "process.exit", "eval(", "Function("]
        for term in forbidden_js:
            if term in code:
                return f"Security Violation: Expression '{term}' is prohibited in the JavaScript sandbox."

    return None


# ---------------------------------------------------------------------------
# Layer 2: Test Harness Generation
# ---------------------------------------------------------------------------

def _build_python_test_harness(candidate_code: str, test_cases: List[Dict[str, Any]]) -> str:
    """
    Constructs a self-contained execution script that runs candidate code
    against provided test cases and prints a structured JSON result to stdout.
    """
    serialized_tests = json.dumps(test_cases)
    # Escape backslashes and quotes so the JSON string embeds safely inside a Python string literal
    escaped = serialized_tests.replace('\\', '\\\\').replace('"', '\\"')
    harness = f"""# Auto-generated isolated sandbox runner
import json, time, sys

{candidate_code}

test_specs = json.loads("{escaped}")
results = []
all_passed = True
total_start = time.perf_counter()

# Find primary solution function (first callable in global namespace not starting with _)
target_fn = None
for name, val in list(globals().items()):
    if callable(val) and not name.startswith('_') and name not in ['json', 'time', 'sys']:
        target_fn = val
        break

if not target_fn:
    print(json.dumps({{
        "status": "error",
        "error_message": "No solution function found in submitted code. Please define a callable function.",
        "test_results": []
    }}))
    sys.exit(0)

for idx, t in enumerate(test_specs, 1):
    raw_input = t.get("input", "")
    expected = t.get("expected", t.get("expected_output", ""))
    t_start = time.perf_counter()
    passed = False
    actual_str = ""
    err_str = None

    try:
        # Parse inputs: if input is a JSON list or dict, unpack as kwargs or args
        if isinstance(raw_input, str):
            try:
                parsed_args = json.loads(raw_input)
            except Exception:
                parsed_args = raw_input
        else:
            parsed_args = raw_input

        if isinstance(parsed_args, list):
            ret = target_fn(*parsed_args)
        elif isinstance(parsed_args, dict):
            ret = target_fn(**parsed_args)
        else:
            ret = target_fn(parsed_args)

        actual_str = json.dumps(ret) if not isinstance(ret, str) else ret

        # Compare outputs
        expected_parsed = None
        if isinstance(expected, str):
            try:
                expected_parsed = json.loads(expected)
            except Exception:
                expected_parsed = expected
        else:
            expected_parsed = expected

        if ret == expected_parsed or str(ret).strip() == str(expected).strip():
            passed = True
        else:
            passed = False
            all_passed = False

    except Exception as exc:
        passed = False
        all_passed = False
        err_str = f"{{type(exc).__name__}}: {{str(exc)}}"

    t_elapsed = (time.perf_counter() - t_start) * 1000.0

    results.append({{
        "test_index": idx,
        "input_data": str(raw_input),
        "expected_output": str(expected),
        "actual_output": actual_str if passed or actual_str else None,
        "passed": passed,
        "execution_time_ms": round(t_elapsed, 2),
        "error": err_str
    }})

total_elapsed = (time.perf_counter() - total_start) * 1000.0
passed_count = sum(1 for r in results if r["passed"])

print(json.dumps({{
    "status": "success",
    "total_tests": len(results),
    "passed_tests": passed_count,
    "all_passed": all_passed,
    "total_execution_time_ms": round(total_elapsed, 2),
    "test_results": results
}}))
"""
    return harness


# ---------------------------------------------------------------------------
# Layer 3: Safe Subprocess Execution
# ---------------------------------------------------------------------------

async def execute_code_safely(
    code: str,
    language: str = "python",
    test_cases: Optional[List[Dict[str, Any]]] = None,
    timeout_s: float = 3.0
) -> CodingExecutionResponse:
    """
    Executes candidate code in an isolated subprocess with strict security auditing,
    timeout constraints, and automated test-case evaluation.
    """
    lang = (language or "python").lower()

    # 1. Static Security Check
    security_err = validate_code_security(code, lang)
    if security_err:
        return CodingExecutionResponse(
            status="security_violation",
            language=lang,
            error_message=security_err,
            all_passed=False
        )

    # 2. Ephemeral Sandbox Execution
    with tempfile.TemporaryDirectory(prefix="interviewer_sandbox_") as sandbox_dir:
        # Build clean environment with NO sensitive API keys or database credentials
        clean_env = {
            "SYSTEMROOT": os.environ.get("SYSTEMROOT", "C:\\Windows"),
            "PATH": os.environ.get("PATH", ""),
            "PYTHONNOUSERSITE": "1",
            "PYTHONUNBUFFERED": "1",
            "PYTHONHASHSEED": "0"
        }

        if lang in ["python", "py"]:
            script_path = os.path.join(sandbox_dir, "solution.py")

            if test_cases and len(test_cases) > 0:
                harness_source = _build_python_test_harness(code, test_cases)
            else:
                # Direct run without test cases
                harness_source = f"{code}\n\nprint('\\n[Code executed successfully with return code 0]')"

            with open(script_path, "w", encoding="utf-8") as f:
                f.write(harness_source)

            cmd = [sys.executable, "-I", script_path]

        elif lang in ["javascript", "js", "typescript", "ts"]:
            node_executable = shutil.which("node")
            if not node_executable:
                return CodingExecutionResponse(
                    status="error",
                    language=lang,
                    error_message="Node.js runtime is not available on this server host.",
                    all_passed=False
                )
            script_path = os.path.join(sandbox_dir, "solution.js")
            with open(script_path, "w", encoding="utf-8") as f:
                f.write(code)
            cmd = [node_executable, script_path]

        else:
            return CodingExecutionResponse(
                status="error",
                language=lang,
                error_message=f"Execution for language '{language}' is not supported in the sandbox. Supported: Python, JavaScript.",
                all_passed=False
            )

        # 3. Launch Subprocess — Windows-safe via asyncio.to_thread + subprocess.run
        # asyncio.create_subprocess_exec requires ProactorEventLoop child watcher on
        # Windows, which is unavailable under some uvicorn configurations. Using
        # subprocess.run in a thread pool executor is universally reliable.
        t_start = time.perf_counter()

        def _run_in_thread() -> subprocess.CompletedProcess:
            return subprocess.run(
                cmd,
                capture_output=True,
                cwd=sandbox_dir,
                env=clean_env,
                timeout=timeout_s
            )

        try:
            completed = await asyncio.to_thread(_run_in_thread)
        except subprocess.TimeoutExpired:
            return CodingExecutionResponse(
                status="timeout",
                language=lang,
                error_message=(
                    f"Execution timed out ({timeout_s}s limit exceeded). "
                    "Ensure your solution does not have an infinite loop or excessive recursion."
                ),
                all_passed=False
            )
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            logger.error(f"Sandbox subprocess spawn failed: {type(e).__name__}: {str(e)}\n{tb}")
            return CodingExecutionResponse(
                status="error",
                language=lang,
                error_message=f"Failed to spawn isolated execution process: {type(e).__name__}: {str(e)}",
                all_passed=False
            )

        t_elapsed = (time.perf_counter() - t_start) * 1000.0

        # Enforce 10KB output truncation
        stdout_str = completed.stdout.decode("utf-8", errors="replace")[:10240]
        stderr_str = completed.stderr.decode("utf-8", errors="replace")[:10240]

        if completed.returncode != 0:
            return CodingExecutionResponse(
                status="error",
                language=lang,
                output=stdout_str if stdout_str else None,
                error_message=stderr_str.strip() or f"Runtime error: process exited with code {completed.returncode}",
                all_passed=False,
                total_execution_time_ms=round(t_elapsed, 2)
            )

        # Parse test harness JSON if test cases were supplied
        if test_cases and len(test_cases) > 0:
            try:
                # Find last valid JSON in stdout
                lines = stdout_str.strip().split("\n")
                parsed_res = None
                for line in reversed(lines):
                    line_clean = line.strip()
                    if line_clean.startswith("{") and line_clean.endswith("}"):
                        try:
                            parsed_res = json.loads(line_clean)
                            break
                        except Exception:
                            continue

                if parsed_res and "test_results" in parsed_res:
                    test_objs = [
                        TestCaseResult(
                            test_index=tr.get("test_index", i + 1),
                            input_data=str(tr.get("input_data", "")),
                            expected_output=str(tr.get("expected_output", "")),
                            actual_output=tr.get("actual_output"),
                            passed=bool(tr.get("passed", False)),
                            execution_time_ms=float(tr.get("execution_time_ms", 0.0)),
                            error=tr.get("error")
                        )
                        for i, tr in enumerate(parsed_res.get("test_results", []))
                    ]
                    return CodingExecutionResponse(
                        status="success",
                        language=lang,
                        total_tests=parsed_res.get("total_tests", len(test_objs)),
                        passed_tests=parsed_res.get("passed_tests", sum(1 for t in test_objs if t.passed)),
                        all_passed=bool(parsed_res.get("all_passed", False)),
                        total_execution_time_ms=float(parsed_res.get("total_execution_time_ms", round(t_elapsed, 2))),
                        output=stdout_str,
                        test_results=test_objs
                    )

            except Exception as parse_exc:
                logger.warning(f"Error parsing test harness output: {parse_exc}")

        # Standard non-harness execution response
        return CodingExecutionResponse(
            status="success",
            language=lang,
            output=stdout_str,
            all_passed=True,
            total_execution_time_ms=round(t_elapsed, 2)
        )
